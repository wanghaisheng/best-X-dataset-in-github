const fs = require('fs');
const path = require('path');

// Load and validate config.json
const configPath = path.resolve(__dirname, 'config.json');
let config;
try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configData);
} catch (error) {
    console.error('Error reading or parsing config.json:', error.message);
    process.exit(1);
}

const locales = ['', 'fr', 'zh', 'es', 'de'];
// const baseDir = path.join(__dirname, '/');
const baseDir = path.dirname(__dirname);


const baseUrl = config.baseUrl || 'https://default-url.com';
const ignoreFolders = ['node_modules','template', 'assets', 'temp','docs'];

function listHtmlFiles(dir) {
    return fs.readdirSync(dir).reduce((files, file) => {
        const filePath = path.join(dir, file);
        const isDirectory = fs.statSync(filePath).isDirectory();
        if (isDirectory && ignoreFolders.includes(file)) {
            return files;
        }
        if (isDirectory) {
            return files.concat(listHtmlFiles(filePath));
        }
        if (path.extname(file) === '.html') {
            return files.concat([filePath]);
        }
        return files;
    }, []);
}

// Get file modification date in ISO format
function getLastModifiedDate(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.mtime.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    } catch (error) {
        return new Date().toISOString().split('T')[0]; // Use current date if error
    }
}

const allHtmlFiles = locales.flatMap(locale => {
    const localeDir = path.join(baseDir, locale);
    if (!fs.existsSync(localeDir)) return [];
    return listHtmlFiles(localeDir).map(file => {
        return {
            path: path.join(locale, path.relative(localeDir, file)).replace(/\\+/g, '/'),
            lastmod: getLastModifiedDate(file)
        };
    });
});

// Create a map to store unique URLs with their metadata
const urlMap = new Map();

// Add root path first
const currentDate = new Date().toISOString().split('T')[0];
urlMap.set('/', { 
    loc: '/', 
    lastmod: currentDate,
    changefreq: 'daily', 
    priority: '1.0' 
});

// Process other URLs
allHtmlFiles.forEach(file => {
    const fileWithoutExtension = file.path.replace('.html', '');
    let loc;
    
    if (fileWithoutExtension.endsWith('index')) {
        // For index pages, remove 'index' and ensure no trailing slash (except root)
        const pathParts = fileWithoutExtension.split('/').slice(0, -1);
        loc = pathParts.length === 0 ? '/' : `/${pathParts.join('/')}`;
    } else {
        // For non-index pages, ensure no trailing slash
        loc = `/${fileWithoutExtension}`.replace(/\/+$/, '');
    }
    
    // Only add if URL doesn't exist or has a newer modification date
    if (!urlMap.has(loc) || file.lastmod > urlMap.get(loc).lastmod) {
        urlMap.set(loc, {
            loc,
            lastmod: file.lastmod,
            changefreq: 'weekly',
            priority: '0.9',
        });
    }
});

// Convert Map to array
const sitemap = Array.from(urlMap.values());

// Generate XML with proper formatting and lastmod dates
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map(item => {
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const cleanLoc = item.loc === '/' ? '' : item.loc;
    
    return `    <url>
        <loc>${cleanBaseUrl}${cleanLoc}</loc>
        <lastmod>${item.lastmod}</lastmod>
        <changefreq>${item.changefreq}</changefreq>
        <priority>${item.priority}</priority>
    </url>`;
}).join('\n')}
</urlset>`;

// Always overwrite sitemap.xml
const sitemapPath = path.join(path.dirname(__dirname), 'sitemap.xml');
fs.writeFileSync(sitemapPath, sitemapXml);
console.log(`Sitemap has been generated and saved to ${sitemapPath}`);

const robotsbasePath = path.dirname(__dirname);

// Always generate robots.txt (overwrite if exists)
// Modify the robots.txt generation part
const robotsContent = [];

// Add allowed bots
if (config.robots?.allowedBots) {
    config.robots.allowedBots.forEach(bot => {
        robotsContent.push(`User-agent: ${bot}`);
    });
    robotsContent.push('Allow: /\n');
}

// Add blocked bots
if (config.robots?.blockedBots) {
    config.robots.blockedBots.forEach(bot => {
        robotsContent.push(`User-agent: ${bot}`);
    });
    robotsContent.push('Disallow: /\n');
}

// --- AI Scraper bots special handling ---
const aiRobotsPath = path.join(__dirname, 'ai-robots.txt');
let aiBots = [];
if (fs.existsSync(aiRobotsPath)) {
    const aiLines = fs.readFileSync(aiRobotsPath, 'utf-8').split(/\r?\n/);
    aiBots = aiLines
        .map(line => line.trim())
        .filter(line => line.toLowerCase().startsWith('user-agent:'))
        .map(line => line.split(':')[1].trim())
        .filter(Boolean);
}
// 获取 config 里已允许的 bot（忽略大小写）
const allowedBotsSet = new Set(
    (config.robots?.allowedBots || []).map(bot => bot.toLowerCase())
);
if (aiBots.length > 0) {
    aiBots.forEach(bot => {
        if (allowedBotsSet.has(bot.toLowerCase())) return; // 如果已允许则跳过
        robotsContent.push(`User-agent: ${bot}`);
        robotsContent.push('Allow: /llms.txt');
        robotsContent.push('Disallow: /\n');
    });
}
// --- End AI Scraper bots special handling ---

// Add general rules
robotsContent.push('User-agent: *');
if (config.robots?.allowedPaths) {
    config.robots.allowedPaths.forEach(path => {
        robotsContent.push(`Allow: ${path}`);
    });
}

// Add sitemap
robotsContent.push(`Sitemap: ${baseUrl}/sitemap.xml`);

// Write robots.txt
const robotsPath = path.join(robotsbasePath, 'robots.txt');
fs.writeFileSync(robotsPath, robotsContent.join('\n'));
console.log(`robots.txt has been ${fs.existsSync(robotsPath) ? 'overwritten' : 'generated'} at ${robotsPath}`);

// Generate CSV with lastmod dates
const csvContent = ['URL,Lastmod,Changefreq,Priority']
    .concat(sitemap.map(item => `${baseUrl}${item.loc},${item.lastmod},${item.changefreq},${item.priority}`))
    .join('\n');

// Always overwrite urls.csv
const csvPath = path.join(__dirname, 'urls.csv');
fs.writeFileSync(csvPath, csvContent);
console.log(`Found URLs have been saved to ${csvPath}`);
