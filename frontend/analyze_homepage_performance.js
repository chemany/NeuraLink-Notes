#!/usr/bin/env node

/**
 * 灵枢笔记主页加载性能分析工具
 * 分析主页启动慢的瓶颈
 */

const axios = require('axios');
const performance = require('perf_hooks').performance;

// 配置参数
const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:3001';
const UNIFIED_SETTINGS_URL = 'http://localhost:3002';

async function analyzeHomepagePerformance() {
    console.log('🔍 灵枢笔记主页性能分析开始...\n');
    
    const results = {
        services: {},
        dependencies: {},
        recommendations: []
    };

    // 1. 检查各个服务的响应时间
    console.log('📡 检查服务响应时间...');
    
    const services = [
        { name: '前端服务', url: FRONTEND_URL, critical: true },
        { name: '后端API', url: `${BACKEND_URL}/api/health`, critical: true },
        { name: '统一设置服务', url: `${UNIFIED_SETTINGS_URL}/api/health`, critical: false }
    ];

    for (const service of services) {
        const start = performance.now();
        try {
            const response = await axios.get(service.url, { 
                timeout: 10000,
                headers: { 'User-Agent': 'Performance-Analyzer' }
            });
            const duration = performance.now() - start;
            results.services[service.name] = {
                status: 'ok',
                duration: duration.toFixed(2),
                statusCode: response.status
            };
            console.log(`  ✅ ${service.name}: ${duration.toFixed(2)}ms (${response.status})`);
            
            if (duration > 1000 && service.critical) {
                results.recommendations.push(`⚠️ ${service.name}响应过慢(${duration.toFixed(2)}ms)，需要优化`);
            }
        } catch (error) {
            const duration = performance.now() - start;
            results.services[service.name] = {
                status: 'error',
                duration: duration.toFixed(2),
                error: error.message
            };
            console.log(`  ❌ ${service.name}: ${duration.toFixed(2)}ms - ${error.message}`);
            
            if (service.critical) {
                results.recommendations.push(`🚨 ${service.name}无法访问，这是主页加载慢的主要原因`);
            }
        }
    }

    // 2. 分析关键API端点性能
    console.log('\n📊 检查关键API端点...');
    
    const apiEndpoints = [
        { name: '笔记本列表', url: `${BACKEND_URL}/api/notebooks`, auth: true },
        { name: '用户认证检查', url: `${BACKEND_URL}/api/auth/validate`, auth: true },
        { name: '统一设置获取', url: `${UNIFIED_SETTINGS_URL}/api/settings`, auth: false }
    ];

    for (const endpoint of apiEndpoints) {
        const start = performance.now();
        try {
            const headers = {};
            if (endpoint.auth) {
                // 尝试获取存储的token（实际环境中会从localStorage获取）
                headers['Authorization'] = 'Bearer dummy-token-for-testing';
            }
            
            const response = await axios.get(endpoint.url, { 
                timeout: 5000,
                headers,
                validateStatus: () => true // 接受所有状态码
            });
            const duration = performance.now() - start;
            
            results.dependencies[endpoint.name] = {
                status: response.status < 500 ? 'ok' : 'error',
                duration: duration.toFixed(2),
                statusCode: response.status
            };
            
            console.log(`  ${response.status < 400 ? '✅' : '⚠️'} ${endpoint.name}: ${duration.toFixed(2)}ms (${response.status})`);
            
            if (duration > 2000) {
                results.recommendations.push(`⚠️ ${endpoint.name}响应过慢(${duration.toFixed(2)}ms)，影响主页加载`);
            }
        } catch (error) {
            const duration = performance.now() - start;
            results.dependencies[endpoint.name] = {
                status: 'timeout',
                duration: duration.toFixed(2),
                error: error.message
            };
            console.log(`  ❌ ${endpoint.name}: ${duration.toFixed(2)}ms - ${error.message}`);
            
            if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
                results.recommendations.push(`🚨 ${endpoint.name}连接超时，可能是网络或服务配置问题`);
            }
        }
    }

    // 3. 模拟完整主页加载流程
    console.log('\n🚀 模拟完整主页加载流程...');
    
    const fullLoadStart = performance.now();
    let loadSteps = [];
    
    try {
        // 步骤1：加载主页HTML
        let stepStart = performance.now();
        const homeResponse = await axios.get(FRONTEND_URL, { timeout: 10000 });
        const homeLoadTime = performance.now() - stepStart;
        loadSteps.push({ step: '主页HTML加载', duration: homeLoadTime.toFixed(2) });
        
        // 步骤2：检查JS/CSS资源（简化模拟）
        stepStart = performance.now();
        await new Promise(resolve => setTimeout(resolve, 100)); // 模拟资源加载
        const resourceLoadTime = performance.now() - stepStart;
        loadSteps.push({ step: '静态资源加载', duration: resourceLoadTime.toFixed(2) });
        
        // 步骤3：认证检查（模拟）
        stepStart = performance.now();
        await new Promise(resolve => setTimeout(resolve, 200)); // 模拟认证流程
        const authCheckTime = performance.now() - stepStart;
        loadSteps.push({ step: '认证检查', duration: authCheckTime.toFixed(2) });
        
        const totalLoadTime = performance.now() - fullLoadStart;
        
        console.log(`  📊 完整加载流程总计: ${totalLoadTime.toFixed(2)}ms`);
        loadSteps.forEach(step => {
            console.log(`    - ${step.step}: ${step.duration}ms`);
        });
        
        if (totalLoadTime > 3000) {
            results.recommendations.push('🐌 主页完整加载超过3秒，用户体验较差');
        }
        
    } catch (error) {
        console.log(`  ❌ 主页加载流程失败: ${error.message}`);
        results.recommendations.push('🚨 主页加载流程存在严重问题，无法完成加载');
    }

    // 4. 生成性能分析报告
    console.log('\n📈 性能分析报告');
    console.log('='.repeat(60));
    
    // 服务状态汇总
    const serviceIssues = Object.entries(results.services).filter(([_, info]) => info.status !== 'ok');
    const dependencyIssues = Object.entries(results.dependencies).filter(([_, info]) => info.status !== 'ok');
    
    console.log(`\n🔍 发现的问题:`);
    if (serviceIssues.length === 0 && dependencyIssues.length === 0) {
        console.log('  ✅ 所有服务和依赖项运行正常');
    } else {
        serviceIssues.forEach(([name, info]) => {
            console.log(`  ❌ ${name}: ${info.error || '响应异常'}`);
        });
        dependencyIssues.forEach(([name, info]) => {
            console.log(`  ⚠️ ${name}: ${info.error || '响应缓慢'}`);
        });
    }
    
    console.log(`\n💡 优化建议:`);
    if (results.recommendations.length === 0) {
        console.log('  ✨ 当前性能表现良好，无需特别优化');
    } else {
        results.recommendations.forEach((rec, index) => {
            console.log(`  ${index + 1}. ${rec}`);
        });
    }
    
    // 具体优化建议
    console.log(`\n🔧 具体优化措施:`);
    console.log('1. 前端优化:');
    console.log('   - 启用Next.js静态生成(SSG)减少首次渲染时间');
    console.log('   - 实施代码分割减少初始包大小');
    console.log('   - 添加加载状态页面改善用户体验');
    
    console.log('2. 后端优化:');
    console.log('   - 实施API响应缓存');
    console.log('   - 优化数据库查询(如有)');
    console.log('   - 添加健康检查端点');
    
    console.log('3. 架构优化:');
    console.log('   - 考虑使用CDN加速静态资源');
    console.log('   - 实施服务预热机制');
    console.log('   - 监控和告警系统');
    
    console.log('\n✅ 性能分析完成');
}

// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('❌ 分析过程中发生未处理错误:', error.message);
    process.exit(1);
});

// 启动分析
analyzeHomepagePerformance().catch(console.error);