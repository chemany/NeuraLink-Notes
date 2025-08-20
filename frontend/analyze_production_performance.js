#!/usr/bin/env node

/**
 * 生产环境灵枢笔记性能分析工具
 * 专门分析 https://www.cheman.top/notepads 的加载性能
 */

const https = require('https');
const http = require('http');
const performance = require('perf_hooks').performance;
const { URL } = require('url');

// 配置参数
const PRODUCTION_URL = 'https://www.cheman.top/notepads';
const LOCAL_BACKEND = 'http://localhost:3001';

// 创建HTTPS agent，忽略SSL证书验证（仅用于测试）
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// 发起HTTP请求的Promise封装
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                ...options.headers
            },
            timeout: options.timeout || 10000,
            agent: isHttps ? httpsAgent : undefined
        };

        const req = client.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data,
                    size: Buffer.byteLength(data)
                });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

async function analyzeProductionPerformance() {
    console.log('🌐 灵枢笔记生产环境性能分析');
    console.log('🎯 目标URL:', PRODUCTION_URL);
    console.log('=' .repeat(60));

    const results = {
        mainPage: {},
        staticResources: {},
        apiEndpoints: {},
        networkAnalysis: {},
        recommendations: []
    };

    // 1. 分析主页加载性能
    console.log('\n📊 分析主页加载性能...');
    
    for (let i = 1; i <= 3; i++) {
        const start = performance.now();
        try {
            console.log(`  🔄 第 ${i} 次测试...`);
            const response = await makeRequest(PRODUCTION_URL, {
                timeout: 15000
            });
            const duration = performance.now() - start;
            
            const testResult = {
                attempt: i,
                duration: duration.toFixed(2),
                statusCode: response.statusCode,
                contentSize: (response.size / 1024).toFixed(2),
                server: response.headers['server'] || 'Unknown',
                contentType: response.headers['content-type'] || 'Unknown'
            };
            
            results.mainPage[`test${i}`] = testResult;
            
            console.log(`    ✅ 状态: ${response.statusCode}, 耗时: ${duration.toFixed(2)}ms, 大小: ${testResult.contentSize}KB`);
            
            if (duration > 5000) {
                results.recommendations.push(`⚠️ 主页加载过慢(${duration.toFixed(2)}ms) - 第${i}次测试`);
            }

            // 分析响应头中的性能指标
            const cacheControl = response.headers['cache-control'];
            if (cacheControl) {
                console.log(`    💾 缓存控制: ${cacheControl}`);
            }

            // 间隔1秒进行下次测试
            if (i < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error) {
            const duration = performance.now() - start;
            console.log(`    ❌ 测试 ${i} 失败: ${error.message} (${duration.toFixed(2)}ms)`);
            results.mainPage[`test${i}`] = {
                attempt: i,
                duration: duration.toFixed(2),
                error: error.message,
                success: false
            };
            results.recommendations.push(`🚨 主页访问失败 - ${error.message}`);
        }
    }

    // 2. 分析静态资源加载
    console.log('\n📦 分析关键静态资源...');
    
    const staticResources = [
        { name: '主CSS', path: '/notepads/_next/static/css/app/layout.css' },
        { name: '主JS', path: '/notepads/_next/static/chunks/main-app.js' },
        { name: 'Favicon', path: '/notepads/favicon.svg' },
        { name: 'Manifest', path: '/notepads/manifest.json' }
    ];

    for (const resource of staticResources) {
        const start = performance.now();
        try {
            const url = `https://www.cheman.top${resource.path}`;
            const response = await makeRequest(url, { timeout: 8000 });
            const duration = performance.now() - start;
            
            results.staticResources[resource.name] = {
                duration: duration.toFixed(2),
                statusCode: response.statusCode,
                size: (response.size / 1024).toFixed(2),
                success: response.statusCode === 200
            };
            
            console.log(`  ${response.statusCode === 200 ? '✅' : '❌'} ${resource.name}: ${duration.toFixed(2)}ms (${(response.size/1024).toFixed(2)}KB)`);
            
            if (duration > 3000) {
                results.recommendations.push(`⚠️ ${resource.name}加载缓慢(${duration.toFixed(2)}ms)`);
            }
        } catch (error) {
            const duration = performance.now() - start;
            console.log(`  ❌ ${resource.name}: ${error.message} (${duration.toFixed(2)}ms)`);
            results.staticResources[resource.name] = {
                duration: duration.toFixed(2),
                error: error.message,
                success: false
            };
        }
    }

    // 3. 检查后端API连通性
    console.log('\n🔌 检查本地后端API连通性...');
    
    try {
        const start = performance.now();
        const response = await makeRequest(`${LOCAL_BACKEND}/api/health`, { timeout: 5000 });
        const duration = performance.now() - start;
        
        results.apiEndpoints.localBackend = {
            duration: duration.toFixed(2),
            statusCode: response.statusCode,
            success: response.statusCode === 200
        };
        
        console.log(`  ✅ 本地后端: ${duration.toFixed(2)}ms (${response.statusCode})`);
    } catch (error) {
        console.log(`  ❌ 本地后端: ${error.message}`);
        results.apiEndpoints.localBackend = {
            error: error.message,
            success: false
        };
        results.recommendations.push('🚨 本地后端API无法访问，可能影响生产环境数据加载');
    }

    // 4. 网络延迟分析
    console.log('\n🌐 网络延迟分析...');
    
    // 测试到cheman.top的网络延迟
    const networkTests = [
        { name: 'cheman.top主域', url: 'https://www.cheman.top/' },
        { name: 'cheman.top/api', url: 'https://www.cheman.top/api/health' }
    ];

    for (const test of networkTests) {
        const start = performance.now();
        try {
            const response = await makeRequest(test.url, { timeout: 5000 });
            const duration = performance.now() - start;
            
            results.networkAnalysis[test.name] = {
                duration: duration.toFixed(2),
                statusCode: response.statusCode,
                success: true
            };
            
            console.log(`  ✅ ${test.name}: ${duration.toFixed(2)}ms`);
        } catch (error) {
            const duration = performance.now() - start;
            console.log(`  ⚠️ ${test.name}: ${error.message} (${duration.toFixed(2)}ms)`);
            results.networkAnalysis[test.name] = {
                duration: duration.toFixed(2),
                error: error.message,
                success: false
            };
        }
    }

    // 5. 生成性能报告
    console.log('\n📈 生产环境性能报告');
    console.log('='.repeat(60));

    // 计算主页平均加载时间
    const mainPageTests = Object.values(results.mainPage).filter(test => !test.error);
    const avgLoadTime = mainPageTests.length > 0 
        ? mainPageTests.reduce((sum, test) => sum + parseFloat(test.duration), 0) / mainPageTests.length 
        : 0;

    console.log(`\n🎯 主页性能汇总:`);
    console.log(`  平均加载时间: ${avgLoadTime.toFixed(2)}ms`);
    console.log(`  成功请求: ${mainPageTests.length}/3`);
    
    if (avgLoadTime > 3000) {
        console.log(`  🚨 性能警告: 主页加载时间超过3秒`);
    } else if (avgLoadTime > 1000) {
        console.log(`  ⚠️ 性能提醒: 主页加载时间超过1秒`);
    } else {
        console.log(`  ✅ 性能良好: 主页加载时间正常`);
    }

    // 静态资源汇总
    const staticResourcesSuccess = Object.values(results.staticResources).filter(r => r.success).length;
    const staticResourcesTotal = Object.keys(results.staticResources).length;
    console.log(`\n📦 静态资源汇总:`);
    console.log(`  成功加载: ${staticResourcesSuccess}/${staticResourcesTotal}`);

    // 网络连通性汇总
    console.log(`\n🌐 网络连通性:`);
    Object.entries(results.networkAnalysis).forEach(([name, result]) => {
        console.log(`  ${result.success ? '✅' : '❌'} ${name}: ${result.duration || 'N/A'}ms`);
    });

    // 优化建议
    console.log(`\n💡 性能优化建议:`);
    if (results.recommendations.length === 0) {
        console.log(`  ✨ 当前性能表现良好`);
    } else {
        results.recommendations.forEach((rec, index) => {
            console.log(`  ${index + 1}. ${rec}`);
        });
    }

    // 针对性优化建议
    console.log(`\n🔧 针对性优化措施:`);
    
    if (avgLoadTime > 3000) {
        console.log(`  🚀 紧急优化:`);
        console.log(`     - 启用CDN加速静态资源`);
        console.log(`     - 优化服务器响应时间`);
        console.log(`     - 实施资源压缩和缓存`);
    }
    
    console.log(`  📊 常规优化:`);
    console.log(`     - 启用Gzip/Brotli压缩`);
    console.log(`     - 设置适当的缓存策略`);
    console.log(`     - 优化图片和字体加载`);
    console.log(`     - 实施懒加载机制`);
    
    if (results.apiEndpoints.localBackend && !results.apiEndpoints.localBackend.success) {
        console.log(`  🔌 后端连接:`);
        console.log(`     - 检查本地后端服务状态`);
        console.log(`     - 确保API路由配置正确`);
        console.log(`     - 验证防火墙和网络配置`);
    }

    console.log('\n✅ 生产环境性能分析完成');
}

// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('❌ 分析过程中发生未处理错误:', error.message);
    process.exit(1);
});

// 启动分析
analyzeProductionPerformance().catch(console.error);