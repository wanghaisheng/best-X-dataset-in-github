import requests
import os
from dotenv import load_dotenv
import json
from pathlib import Path
import logging
import time
import argparse
from typing import List, Dict, Any, TypedDict
from google_search import google_search

load_dotenv()

# Constants
GITHUB_API_BASE_URL = "https://api.github.com/search/repositories"
GITHUB_API_VERSION = "2022-11-28"

class RepoData(TypedDict):
    """Define the structure of a single repository's data"""
    name: str
    description: str
    html_url: str
    stars: int
    forks: int


def search_github_repos(
    keywords: List[str], token: str = None, min_stars: int = 0, min_forks: int = 0
) -> Dict[str, List[RepoData]]:
    """
    Searches GitHub repositories for given keywords, filtering by stars and forks.

    Args:
        keywords (list): A list of keywords to search for.
        token (str, optional): A GitHub personal access token for higher rate limits. Defaults to None.
        min_stars (int, optional): Minimum number of stars a repo should have. Defaults to 0.
        min_forks (int, optional): Minimum number of forks a repo should have. Defaults to 0.

    Returns:
        dict: A dictionary where keys are keywords and values are lists of RepoData objects.
            Returns empty dict if there are no results for a keyword.

    Raises:
        requests.exceptions.RequestException: If there's an error during the API request.
    """
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    repo_data = {}
    for keyword in keywords:
        params = {"q": keyword}
        try:
            all_repo_data_for_keyword = []
            next_page_url = GITHUB_API_BASE_URL
            while next_page_url:
                logging.info(f"Searching for '{keyword}' at '{next_page_url}'")
                response = requests.get(
                    next_page_url, headers=headers, params=params
                )
                response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)

                data = response.json()
                logging.debug(f"API response data: {data}")
                repo_data_for_keyword = []
                for item in data.get("items", []):
                    if (
                        item["stargazers_count"] >= min_stars
                        and item["forks_count"] >= min_forks
                    ):
                        repo_data_for_keyword.append(
                            RepoData(
                                name=item["name"],
                                description=item["description"],
                                html_url=item["html_url"],
                                stars=item["stargazers_count"],
                                forks=item["forks_count"],
                            )
                        )
                all_repo_data_for_keyword.extend(repo_data_for_keyword)
                # Handle Pagination
                if "Link" in response.headers:
                    link_header = response.headers["Link"]
                    next_links = [
                        link.split(";")[0].strip("<>")
                        for link in link_header.split(",")
                        if 'rel="next"' in link
                    ]
                    next_page_url = next_links[0] if next_links else None
                else:
                    next_page_url = None

            repo_data[keyword] = all_repo_data_for_keyword
        except requests.exceptions.RequestException as e:
            logging.error(f"Error searching for '{keyword}': {e}")
            repo_data[keyword] = []  # ensure there's always an entry even with errors
            time.sleep(
                60
            )  # In case of rate limit or other error, wait a minute before trying again

    return repo_data

def search_google_description(domain: str) -> str:
      """Searches Google for a domain and returns the first result's description."""
      try:
          search_results = google_search.search(queries=[f"site:{domain}"])
          if search_results and search_results[0].get("snippet"):
            return search_results[0].get("snippet")
          else:
              logging.warning(f"No google search description found for domain: {domain}")
              return None
      except Exception as e:
          logging.error(f"Error during Google search for {domain}: {e}")
          return None


def load_existing_data(filepath: Path) -> Dict[str, Any]:
    """Loads existing data from a JSON file or returns an empty dict if the file does not exist.

    Args:
        filepath (str): The path to the JSON file.

    Returns:
        dict: The loaded data, or an empty dictionary if the file doesn't exist
        or there is a json exception.
    """
    if not filepath.exists():
        logging.info("Data file not found. Starting with empty results")
        return {}
    try:
        with open(filepath, "r") as f:
            return json.load(f)
    except json.JSONDecodeError:
        logging.warning("Error decoding JSON file. Starting with empty results")
        return {}


def save_data(filepath: Path, data: Dict[str, Any]) -> None:
    """Saves data to a JSON file.

    Args:
        filepath (str): The path to the JSON file.
        data (dict): The data to save.
    """
    # ensure parent directory exists
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=lambda o: o.__dict__)


def merge_and_save_results(
    keywords: List[str],
    token: str,
    output_filepath: Path,
    min_stars: int = 0,
    min_forks: int = 0,
) -> None:
    """Searches, loads existing data, merges, and saves new data.

    Args:
       keywords (list): A list of keywords to search for.
       token (str, optional): A GitHub personal access token for higher rate limits. Defaults to None.
       output_filepath (str) : Path to save the results to
       min_stars (int, optional): Minimum number of stars a repo should have. Defaults to 0.
       min_forks (int, optional): Minimum number of forks a repo should have. Defaults to 0.
    """
    # 1. search github for keywords, with filter criteria
    new_results = search_github_repos(keywords, token, min_stars, min_forks)

    # 2. Load existing data (or initialize an empty dict)
    existing_data = load_existing_data(output_filepath)

    # 3.  Merge the data, make them unique
    merged_data = {}
    for keyword, new_repos in new_results.items():
         if not new_repos:
            logging.warning(f"No results for {keyword}. skipping...")
            continue #Skip if there are no results
        for repo in new_repos:
              domain =  repo['html_url'].split('/')[2]
              if domain in merged_data:
                  if not isinstance(merged_data[domain]["description"], list):
                      merged_data[domain]["description"] = [merged_data[domain]["description"]]
                  merged_data[domain]["description"].append(repo["description"])
              else:
                 google_description = search_google_description(domain)

                 merged_data[domain] = {
                  "description" : [repo["description"]],
                  "domain_strength": None,
                  "est_mo_clicks": 0,
                  "google_description": google_description

                 }
        for domain, existing_info in existing_data.items():
             if domain not in merged_data:
                 google_description = search_google_description(domain)
                 merged_data[domain] = {
                   "description": existing_info.get("description", []),
                   "domain_strength": existing_info.get("domain_strength"),
                   "est_mo_clicks": existing_info.get("est_mo_clicks",0),
                    "google_description": google_description
                   }
             else:
                  merged_data[domain]["domain_strength"]= existing_info.get("domain_strength")
                  merged_data[domain]["est_mo_clicks"]= existing_info.get("est_mo_clicks",0)


    # 4. save to file
    save_data(output_filepath, merged_data)
    logging.info(f"Results saved to: {output_filepath}")


def validate_config(min_stars: int, min_forks: int):
    if not isinstance(min_stars, int) or min_stars < 0:
        raise ValueError("min_stars must be a non-negative integer")
    if not isinstance(min_forks , int) or min_forks < 0:
        raise ValueError("min_forks must be a non-negative integer")



if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
    )

    # Setup argument parser
    parser = argparse.ArgumentParser(description="Search and merge GitHub repository data")
    args = parser.parse_args()

    # Load Configuration
    keywords_str = os.getenv("KEYWORDS_ENV")
    if keywords_str:
        keywords_to_search = [keyword.strip() for keyword in keywords_str.split(",") if keyword.strip()]
    else:
        keywords_to_search = []
        logging.error("No Keywords specified. Please specify via KEYWORDS_ENV.")
        exit(1)

    github_token = os.getenv("GITHUB_TOKEN")
    try:
        min_stars_filter = int(os.getenv("MIN_STARS", 10))
        min_forks_filter = int(os.getenv("MIN_FORKS", 10))
    except ValueError as e:
        logging.error(f"Error parsing MIN_STARS or MIN_FORKS env variables: {e}")
        exit(1)

    output_file = Path(os.getenv("OUTPUT_FILE", "results/data.json"))

    validate_config(min_stars_filter, min_forks_filter)

    merge_and_save_results(
        keywords_to_search,
        github_token,
        output_file,
        min_stars_filter,
        min_forks_filter,
    )
