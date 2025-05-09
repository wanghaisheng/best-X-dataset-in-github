const fs = require('fs');
const path = require('path');

// Load and validate config.json
const configPath = path.resolve(__dirname, 'config.json');
let config;
try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    console.log('[ldjson] 读取config.json成功:', configPath);
    config = JSON.parse(configData);
} catch (error) {
    console.error('[ldjson] 读取或解析config.json出错:', error.message);
    process.exit(1);
}

const locales = ['', 'fr', 'zh', 'es', 'de'];
const baseDir = path.dirname(__dirname);
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

const allHtmlFiles = locales.flatMap(locale => {
    const localeDir = path.join(baseDir, locale);
    if (!fs.existsSync(localeDir)) return [];
    const files = listHtmlFiles(localeDir).map(file => ({
        path: path.join(locale, path.relative(localeDir, file)).replace(/\\+/g, '/')
    }));
    if (files.length > 0) {
        console.log(`[ldjson] 发现${locale ? locale : '默认'}目录下HTML文件数:`, files.length);
    }
    return files;
});

// --- LD+JSON GENERATORS ---

function genWebSite(config) {
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": config.website?.name || config.business?.name || "",
        "url": config.baseUrl,
        "potentialAction": {
            "@type": "SearchAction",
            "target": config.website?.searchUrl || (config.baseUrl + "/search/{search_term_string}"),
            "query-input": "required name=search_term_string"
        }
    };
}

function genOrganization(config) {
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": config.business?.name || "",
        "url": config.baseUrl,
        "logo": config.business?.image || "",
        "contactPoint": [{
            "@type": "ContactPoint",
            "email": config.email || "",
            "contactType": "customer support"
        }],
        "sameAs": config.business?.sameAs || []
    };
}

function genSoftwareApplication(config) {
    return {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": config.software?.name || "",
        "operatingSystem": config.software?.operatingSystem || "any",
        "applicationCategory": config.software?.applicationCategory || "WebApplication",
        "description": config.software?.description || "",
        "image": config.software?.image || "",
        "author": {
            "@type": "Organization",
            "name": config.software?.author || config.business?.name || ""
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": config.software?.aggregateRating?.ratingValue || "5.0",
            "ratingCount": config.software?.aggregateRating?.ratingCount || "1",
            "bestRating": config.software?.aggregateRating?.bestRating || "5",
            "worstRating": config.software?.aggregateRating?.worstRating || "1"
        },
        "offers": {
            "@type": "Offer",
            "price": config.software?.offers?.price || 0,
            "priceCurrency": config.software?.offers?.priceCurrency || "USD",
            "category": config.software?.offers?.category || "free"
        }
    };
}

function genBreadcrumbList(config, pageTitle) {
    // You can customize this to generate dynamic breadcrumbs per page
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": config.baseUrl
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": pageTitle || config.website?.name || config.business?.name || "",
                "item": config.baseUrl // You can customize this per page
            }
        ]
    };
}

const templatesDir = path.join(__dirname, 'ldjson');

function loadTemplate(templateName) {
    const templatePath = path.join(templatesDir, `${templateName}.json`);
    if (!fs.existsSync(templatePath)) {
        console.warn(`[ldjson] 模板不存在: ${templatePath}`);
        return null;
    }
    console.log(`[ldjson] 加载模板: ${templatePath}`);
    return fs.readFileSync(templatePath, 'utf-8');
}

function renderTemplate(templateStr, data) {
    // Simple {{key}} replacement, supports nested keys like a.b.c
    const rendered = templateStr.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
        const value = key.split('.').reduce((o, k) => (o ? o[k] : ''), data);
        return value !== undefined ? value : '';
    });
    console.log('[ldjson] 渲染模板完成');
    return rendered;
}

// --- INJECTION LOGIC ---

function genFAQPage(faqList) {
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqList.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
            }
        }))
    };
}

function genArticle(config, articleData) {
    return {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": articleData.headline || "",
        "image": articleData.image || "",
        "author": {
            "@type": "Person",
            "name": articleData.author || config.software?.author || config.business?.name || ""
        },
        "datePublished": articleData.datePublished || "",
        "dateModified": articleData.dateModified || "",
        "articleBody": articleData.body || ""
    };
}

function extractFAQFromHtml(html) {
    // Simple extraction: look for elements with class "faq-question" and "faq-answer"
    // You can enhance this logic as needed
    const faqRegex = /<div[^>]*class=["'][^"']*faq-question[^"']*["'][^>]*>(.*?)<\/div>\s*<div[^>]*class=["'][^"']*faq-answer[^"']*["'][^>]*>(.*?)<\/div>/gis;
    let match, faqs = [];
    while ((match = faqRegex.exec(html)) !== null) {
        faqs.push({
            question: match[1].replace(/<[^>]+>/g, '').trim(),
            answer: match[2].replace(/<[^>]+>/g, '').trim()
        });
    }
    if (faqs.length > 0) {
        console.log(`[ldjson] 提取FAQ数量: ${faqs.length}`);
    }
    return faqs;
}

function extractArticleDataFromHtml(html) {
    // Simple extraction: get title, author, date, body
    const headline = (html.match(/<h1[^>]*>(.*?)<\/h1>/i) || [])[1] || '';
    const author = (html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
    const datePublished = (html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
    const dateModified = (html.match(/<meta[^>]+property=["']article:modified_time["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
    const image = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
    // For body, just grab the main content div as a fallback
    const body = (html.match(/<div[^>]+class=["'][^"']*article-body[^"']*["'][^>]*>([\s\s]*?)<\/div>/i) || [])[1] || '';
    console.log('[ldjson] 提取文章数据:', { headline, author, datePublished, dateModified, image });
    return { headline, author, datePublished, dateModified, image, body };
}

function hasLdJson(html, ldType) {
    const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const match of scripts) {
        try {
            const data = JSON.parse(match[1].trim());
            if (Array.isArray(data)) {
                if (data.some(item => item['@type'] === ldType)) return true;
            } else if (data['@type'] === ldType) {
                return true;
            }
        } catch (e) { continue; }
    }
    return false;
}

function getPageCategory(absPath, html) {
    const relPath = absPath.replace(baseDir, '').replace(/\\/g, '/').toLowerCase();
    const filename = path.basename(absPath).toLowerCase();

    if (relPath.includes('/blog/') || relPath.includes('/posts/') || /<article/i.test(html)) {
        return 'blog';
    }
    if (relPath.includes('/faq/') || filename.includes('faq')) {
        return 'faq';
    }
    if (relPath.includes('/product/') || filename.includes('product')) {
        return 'product';
    }
    if (relPath.includes('/game/') || filename.includes('game')) {
        return 'game';
    }
    return 'app'; // default bundle for generic app pages
}

function getTemplatesForCategory(category) {
    switch (category) {
        case 'blog':
            return ['article', 'breadcrumblist', 'organization'];
        case 'faq':
            return ['faqpage', 'breadcrumblist', 'organization'];
        case 'product':
            return ['product', 'breadcrumblist', 'organization'];
        case 'game':
            return ['game', 'breadcrumblist', 'organization'];
        case 'app':
        default:
            return ['website', 'organization', 'softwareapplication', 'breadcrumblist'];
    }
}

function injectLdJsonIfNeeded(html, config, pageTitle, absPath) {
    const inserts = [];

    // 解析语言和页面名
    const relPath = path.relative(baseDir, absPath).replace(/\\/g, '/');
    const parts = relPath.split('/');
    let lang = config.defaultLang || 'en';
    let pageName = '';
    if (parts.length === 2 && locales.includes(parts[0])) {
        lang = parts[0];
        pageName = path.basename(parts[1], '.html').toLowerCase();
    } else {
        pageName = path.basename(parts[parts.length - 1], '.html').toLowerCase();
    }
    // 修复首页 index.html 匹配目录
    if (pageName === 'index') {
        // 优先多语言目录
        const ldjsonDirLang = path.join(__dirname, 'ldjson', lang, 'index');
        const ldjsonDirDefault = path.join(__dirname, 'ldjson', 'index');
        let ldjsonDir = '';
        if (fs.existsSync(ldjsonDirLang) && fs.statSync(ldjsonDirLang).isDirectory()) {
            ldjsonDir = ldjsonDirLang;
        } else if (fs.existsSync(ldjsonDirDefault) && fs.statSync(ldjsonDirDefault).isDirectory()) {
            ldjsonDir = ldjsonDirDefault;
        }
        if (ldjsonDir) {
            const jsonFiles = fs.readdirSync(ldjsonDir).filter(f => f.endsWith('.json'));
            for (const jsonFile of jsonFiles) {
                const jsonPath = path.join(ldjsonDir, jsonFile);
                try {
                    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
                    let typeName = '';
                    try {
                        const jsonObj = JSON.parse(jsonContent);
                        typeName = jsonObj['@type'];
                    } catch {}
                    // 检查页面中是否已存在同类型@type的ld+json脚本，若已存在则跳过
                    if (!typeName || !hasLdJson(html, typeName)) {
                        inserts.push('<script type="application/ld+json">\n' + jsonContent + '\n</script>');
                    }
                } catch (e) {
                    console.warn(`[ldjson] 读取json文件失败: ${jsonPath}`, e.message);
                }
            }
        }
    } else {
        // 多语言目录优先查找
        const ldjsonDirLang = path.join(__dirname, 'ldjson', lang, pageName);
        const ldjsonDirDefault = path.join(__dirname, 'ldjson', pageName);
        let ldjsonDir = '';
        if (fs.existsSync(ldjsonDirLang) && fs.statSync(ldjsonDirLang).isDirectory()) {
            ldjsonDir = ldjsonDirLang;
        } else if (fs.existsSync(ldjsonDirDefault) && fs.statSync(ldjsonDirDefault).isDirectory()) {
            ldjsonDir = ldjsonDirDefault;
        }
        if (ldjsonDir) {
            const jsonFiles = fs.readdirSync(ldjsonDir).filter(f => f.endsWith('.json'));
            for (const jsonFile of jsonFiles) {
                const jsonPath = path.join(ldjsonDir, jsonFile);
                try {
                    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
                    let typeName = '';
                    try {
                        const jsonObj = JSON.parse(jsonContent);
                        typeName = jsonObj['@type'];
                    } catch {}
                    // 检查页面中是否已存在同类型@type的ld+json脚本，若已存在则跳过
                    if (!typeName || !hasLdJson(html, typeName)) {
                        inserts.push('<script type="application/ld+json">\n' + jsonContent + '\n</script>');
                    }
                } catch (e) {
                    console.warn(`[ldjson] 读取json文件失败: ${jsonPath}`, e.message);
                }
            }
        }
    }
    if (inserts.length === 0) return html;
    return html.replace(/<\/head>/i, inserts.join('\n') + '\n</head>');
}

// --- MAIN PROCESS ---

// 预生成全站通用的 website 和 organization ld+json，只生成一次
const globalLdJsonTypes = ['website', 'organization'];
const globalLdJsonCache = {};
globalLdJsonTypes.forEach(type => {
    const dir = path.join(__dirname, 'ldjson', type);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        const jsonFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        globalLdJsonCache[type] = jsonFiles.map(jsonFile => {
            const jsonPath = path.join(dir, jsonFile);
            try {
                return fs.readFileSync(jsonPath, 'utf-8');
            } catch {
                return null;
            }
        }).filter(Boolean);
    }
});

allHtmlFiles.forEach(fileObj => {
    const absPath = path.join(baseDir, fileObj.path);
    if (!fs.existsSync(absPath)) return;
    let html = fs.readFileSync(absPath, 'utf-8');
    let pageTitle = '';
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) pageTitle = titleMatch[1];
    let newHtml = html;
    // 先注入全站通用的 website 和 organization ld+json
    let globalInserts = [];
    for (const type of globalLdJsonTypes) {
        if (globalLdJsonCache[type]) {
            globalLdJsonCache[type].forEach(jsonContent => {
                let typeName = '';
                try {
                    const jsonObj = JSON.parse(jsonContent);
                    typeName = jsonObj['@type'];
                } catch {}
                if (!typeName || !hasLdJson(newHtml, typeName)) {
                    globalInserts.push('<script type="application/ld+json">\n' + jsonContent + '\n</script>');
                }
            });
        }
    }
    if (globalInserts.length > 0) {
        newHtml = newHtml.replace(/<\/head>/i, globalInserts.join('\n') + '\n</head>');
    }
    // 再注入页面专属的 ld+json
    newHtml = injectLdJsonIfNeeded(newHtml, config, pageTitle, absPath);
    if (newHtml !== html) {
        fs.writeFileSync(absPath, newHtml, 'utf-8');
        console.log(`Injected missing ld+json into ${absPath}`);
    }
});
