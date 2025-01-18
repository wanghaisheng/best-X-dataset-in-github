import requests
import os
from dotenv import load_dotenv
import yaml

load_dotenv()

def search_github_repos(keywords, token=None, secret_key=None):
    """
    Searches GitHub repositories for given keywords.

    Args:
        keywords (list): A list of keywords to search for.
        token (str, optional): A GitHub personal access token for higher rate limits. Defaults to None.
        secret_key (str, optional) : An additional secret key to demonstrate yml retrieval, default to None

    Returns:
        dict: A dictionary where keys are keywords and values are lists of repository URLs.
             Returns empty dict if there are no results for a keyword.

    Raises:
        requests.exceptions.RequestException: If there's an error during the API request.
    """

    base_url = "https://api.github.com/search/repositories"
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    repo_urls = {}
    for keyword in keywords:
        params = {"q": keyword}
        try:
            response = requests.get(base_url, headers=headers, params=params)
            response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)

            data = response.json()
            repo_urls_for_keyword = [item["html_url"] for item in data.get("items", [])]
            repo_urls[keyword] = repo_urls_for_keyword
        except requests.exceptions.RequestException as e:
            print(f"Error searching for '{keyword}': {e}")
            repo_urls[keyword] = [] # ensure there's always an entry even with errors

    if secret_key: # to demonstrate that secret key was provided
        print (f"secret key provided and printed:{secret_key}")

    return repo_urls

if __name__ == "__main__":
    keywords_to_search = [
        "machine learning",
        "data analysis",
        "web development",
        "python",
        "javascript"
    ]
    github_token = os.getenv("GITHUB_TOKEN")
    secret_yaml_str = os.getenv("SECRET_YAML")

    secret_dict = None
    if secret_yaml_str:
          try:
            secret_dict = yaml.safe_load(secret_yaml_str)
            secret_key = secret_dict.get("api_key")
          except yaml.YAMLError as e:
                print(f"Error parsing SECRET_YAML: {e}")
                secret_key = None # ensure key is None
    else:
          secret_key = None  # ensure key is None


    results = search_github_repos(keywords_to_search, github_token,secret_key)

    if results:
         for keyword, urls in results.items():
            print(f"Repositories for '{keyword}':")
            if urls:
                for url in urls:
                    print(f"  - {url}")
            else:
                print(f"  - No repositories found for '{keyword}'.")
            print("-" * 30)
    else:
         print("No results found. Please check the keywords or your connection.")
