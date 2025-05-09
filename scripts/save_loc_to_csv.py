import os
import csv
import re
from datetime import datetime
import time
import sys

def extract_loc_urls_from_xml(xml_content):
    pattern = re.compile(r'<loc>(.*?)</loc>')
    return pattern.findall(xml_content)

def remove_prefix(url, prefix="https://apps.apple.com/"):
    if url.startswith(prefix):
        return url[len(prefix):]
    return url

def save_to_csv(urls, csv_path):
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['url'])
        for url in urls:
            writer.writerow([url])

def read_progress(progress_path):
    if not os.path.exists(progress_path):
        return []
    with open(progress_path, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]

def write_progress(progress_path, sitemaps):
    with open(progress_path, 'w', encoding='utf-8') as f:
        for sitemap in sitemaps:
            f.write(sitemap + '\n')

def main():
    start_time = time.time()
    max_minutes = 100
    progress_path = os.path.join(os.path.dirname(__file__), 'loc_progress.txt')
    result_dir = os.path.join(os.path.dirname(__file__), 'loc_csv_results')
    os.makedirs(result_dir, exist_ok=True)
    date_str = datetime.now().strftime('%Y%m%d')
    # 读取待处理子sitemap
    sitemaps = read_progress(progress_path)
    if not sitemaps:
        print('无待处理子sitemap，自动退出')
        return
    for sitemap in list(sitemaps):
        print(f'处理: {sitemap}')
        try:
            with open(sitemap, 'r', encoding='utf-8') as f:
                xml_content = f.read()
            loc_urls = extract_loc_urls_from_xml(xml_content)
            loc_urls = [remove_prefix(url) for url in loc_urls]
            csv_path = os.path.join(result_dir, f'loc_{date_str}.csv')
            save_to_csv(loc_urls, csv_path)
            print(f'保存到: {csv_path}, 共{len(loc_urls)}条')
            sitemaps.remove(sitemap)
            write_progress(progress_path, sitemaps)
        except Exception as e:
            print(f'处理{sitemap}出错: {e}')
        # 检查超时
        elapsed = (time.time() - start_time) / 60
        if elapsed > max_minutes:
            print('超时，自动保存并退出')
            write_progress(progress_path, sitemaps)
            sys.exit(0)
    print('全部处理完成')

if __name__ == '__main__':
    main()