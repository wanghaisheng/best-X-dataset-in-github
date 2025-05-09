import requests
import gzip
import xml.etree.ElementTree as ET
from io import BytesIO
import logging
from datetime import datetime
from dotenv import load_dotenv
import hashlib
import os
import concurrent.futures


load_dotenv()

# Constants for D1 Database
D1_DATABASE_ID = os.getenv('D1_APP_DATABASE_ID')
CLOUDFLARE_ACCOUNT_ID = os.getenv('CLOUDFLARE_ACCOUNT_ID')
CLOUDFLARE_API_TOKEN = os.getenv('CLOUDFLARE_API_TOKEN')

CLOUDFLARE_BASE_URL = f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/d1/database/{D1_DATABASE_ID}"

# Set up logging configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("data/app_profiles.log"),
        logging.StreamHandler()
    ]
)

def calculate_row_hash(url, lastmodify):
    """
    Generate a row hash using the URL and lastmodify timestamp.
    Using lastmodify ensures that the hash only changes if the content changes.
    """
    hash_input = f"{url}{lastmodify}"
    return hashlib.sha256(hash_input.encode()).hexdigest()

def extract_links_from_xml(xml_root, tag="loc"):
    """
    Extract links or other elements from the given XML root using the specified tag.
    """
    namespaces = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}  # Define the correct namespace
    return [element.text for element in xml_root.findall(f".//ns:{tag}", namespaces)]


def fetch_and_parse_sitemap(url):
    """
    Fetch the Sitemap XML file and parse it to get all <loc> links.
    """
    try:
        logging.debug(f"Fetching sitemap from URL: {url}")
        response = requests.get(url)
        response.raise_for_status()
        logging.info(f"Successfully fetched sitemap from {url}")
        sitemap_xml = response.text

        # Parse XML to extract all <loc> links using extract_links_from_xml
        tree = ET.ElementTree(ET.fromstring(sitemap_xml))
        root = tree.getroot()
        loc_tags = extract_links_from_xml(root, tag="loc")
        
        logging.debug(f"Extracted {len(loc_tags)} <loc> links from sitemap.")
        return loc_tags
    except requests.RequestException as e:
        logging.error(f"Failed to fetch sitemap: {e} - URL: {url}")
        return []
    except ET.ParseError as e:
        logging.error(f"XML parsing error for sitemap at URL {url}: {e}")
        return []

def fetch_and_parse_gzip_stream(url):
    """
    Efficiently stream and parse a GZipped XML file, extracting all <loc> URLs.
    Returns a list of URLs. Designed for very large XML files (100,000+ rows).
    """
    try:
        logging.debug(f"Fetching GZipped sitemap from URL: {url}")
        response = requests.get(url)
        response.raise_for_status()
        with gzip.GzipFile(fileobj=BytesIO(response.content)) as f:
            context = ET.iterparse(f, events=("end",))
            loc_list = []
            ns = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
            for event, elem in context:
                if elem.tag == ns + 'loc':
                    if elem.text:
                        loc_list.append(elem.text)
                elem.clear()
            logging.debug(f"[stream] Extracted {len(loc_list)} <loc> URLs from GZipped sitemap.")
            return loc_list
    except requests.RequestException as e:
        logging.error(f"Failed to fetch or parse GZipped sitemap: {e} - URL: {url}")
        return []
    except ET.ParseError as e:
        logging.error(f"XML parsing error for GZipped sitemap at URL {url}: {e}")
        return []

def extract_app_id_from_url(url):
    """
    从app url中提取id（如id1273216352），未匹配返回None。
    """
    import re
    match = re.search(r'id(\d+)', url)
    return match.group(0) if match else None


def save_id_list_to_file(id_list, file_path):
    """
    保存id列表到文本文件，每行一个id。
    """
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        for app_id in id_list:
            f.write(f"{app_id}\n")


def load_id_list_from_file(file_path):
    """
    从文本文件读取id列表。
    """
    if not os.path.exists(file_path):
        return set()
    with open(file_path, 'r', encoding='utf-8') as f:
        return set(line.strip() for line in f if line.strip())


def compare_new_ids(today_ids, history_ids):
    """
    对比今日id集合与历史id集合，返回新增id集合。
    """
    return today_ids - history_ids


def analyze_and_report_new_apps(today_id_file, history_id_file, report_file):
    """
    对比今日与历史id，输出新增app报告。
    """
    today_ids = load_id_list_from_file(today_id_file)
    history_ids = load_id_list_from_file(history_id_file)
    new_ids = compare_new_ids(today_ids, history_ids)
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(f"今日新增app数量: {len(new_ids)}\n")
        for app_id in sorted(new_ids):
            f.write(f"{app_id}\n")
    print(f"今日新增app数量: {len(new_ids)}，详情见: {report_file}")


def fetch_and_parse_gzip_stream_with_lastmod(url, lastmod, existing_id_date_map, today):
    """
    解析GZipped XML文件，提取每个app的loc、lastmodified和添加日期。
    """
    import re
    try:
        logging.debug(f"Fetching GZipped sitemap from URL: {url}")
        response = requests.get(url)
        response.raise_for_status()
        with gzip.GzipFile(fileobj=BytesIO(response.content)) as f:
            context = ET.iterparse(f, events=("end",))
            ns = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
            app_details = []
            for event, elem in context:
                if elem.tag == ns + 'url':
                    loc = elem.find(ns + 'loc')
                    lastmod_elem = elem.find(ns + 'lastmod')
                    loc_text = loc.text if loc is not None else None
                    lastmod_text = lastmod_elem.text if lastmod_elem is not None else lastmod
                    app_id = extract_app_id_from_url(loc_text) if loc_text else None
                    if app_id:
                        add_date = existing_id_date_map.get(app_id, today)
                        app_details.append({
                            'id': app_id,
                            'loc': loc_text,
                            'lastmodified': lastmod_text,
                            'added_date': add_date
                        })
                elem.clear()
            logging.debug(f"[stream] Extracted {len(app_details)} app details from GZipped sitemap.")
            return app_details
    except requests.RequestException as e:
        logging.error(f"Failed to fetch or parse GZipped sitemap: {e} - URL: {url}")
        return []
    except ET.ParseError as e:
        logging.error(f"XML parsing error for GZipped sitemap at URL {url}: {e}")
        return []


def load_app_details_json(file_path):
    """
    加载app详情JSON文件，返回id到详情的映射。
    """
    import json
    if not os.path.exists(file_path):
        return {}
    with open(file_path, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
            return {item['id']: item for item in data}
        except Exception:
            return {}


def save_app_details_json(app_details, file_path):
    """
    保存app详情到JSON文件。
    """
    import json
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(app_details, f, ensure_ascii=False, indent=2)


def process_sitemaps_and_save_profiles():
    """
    Process the sitemaps and save app profiles.
    """
    sitemap_url = "https://apps.apple.com/sitemaps_apps_index_app_1.xml"
    loc_urls = fetch_and_parse_sitemap(sitemap_url)
    print('gz count',len(loc_urls))
    today = datetime.now().strftime('%Y-%m-%d')
    data_dir = os.path.join(os.path.dirname(__file__), '../data')
    os.makedirs(data_dir, exist_ok=True)
    details_file = os.path.join(data_dir, f"app_details.json")
    existing_id_detail_map = load_app_details_json(details_file)
    existing_id_date_map = {k: v['added_date'] for k, v in existing_id_detail_map.items()}
    all_app_details = list(existing_id_detail_map.values())
    for loc_url in loc_urls[:1]:
        print(f'processing sitemap:{loc_url}')
        lastmod = None
        app_details = fetch_and_parse_gzip_stream_with_lastmod(loc_url, lastmod, existing_id_date_map, today)
        print('app_details count',len(app_details))
        id_set = set(existing_id_detail_map.keys())
        for detail in app_details:
            if detail['id'] not in id_set:
                all_app_details.append(detail)
                id_set.add(detail['id'])
        save_app_details_json(all_app_details, details_file)
        id_list = [detail['id'] for detail in app_details]
        id_file = os.path.join(data_dir, f"app_ids_{today}.txt")
        save_id_list_to_file(id_list, id_file)
        history_id_file = os.path.join(data_dir, "app_ids_history.txt")
        report_file = os.path.join(data_dir, f"new_apps_{today}.txt")
        # analyze_and_report_new_apps(id_file, history_id_file, report_file)
        # 可选：更新历史id文件（追加或合并）
        all_ids = load_id_list_from_file(history_id_file).union(set(id_set))
        save_id_list_to_file(sorted(all_ids), history_id_file)

# Start the process


def batch_process_in_chunks(data_list, process_function, chunk_size=100):
    """
    将数据分块并批量处理。
    """
    for i in range(0, len(data_list), chunk_size):
        chunk = data_list[i:i+chunk_size]
        # process_function(chunk)
process_sitemaps_and_save_profiles()
