#!/usr/bin/env node

/**
 * PDF预览性能监测脚本
 * 分析双击PDF到成功预览的完整流程性能
 */

const axios = require('axios');
const performance = require('perf_hooks').performance;

// 配置参数
const BACKEND_BASE_URL = 'http://localhost:3001';
const FRONTEND_BASE_URL = 'http://localhost:3000';
const TEST_ITERATIONS = 3; // 测试轮次

// 模拟获取文档列表
async function fetchDocuments(notebookId = 'test-notebook') {
    const start = performance.now();
    try {
        const response = await axios.get(`${BACKEND_BASE_URL}/api/documents/notebook/${notebookId}`);
        const duration = performance.now() - start;
        console.log(`📊 获取文档列表: ${duration.toFixed(2)}ms`);
        return {
            success: true,
            duration,
            documents: response.data.filter(doc => doc.fileName.toLowerCase().endsWith('.pdf'))
        };
    } catch (error) {
        const duration = performance.now() - start;
        console.error(`❌ 获取文档列表失败: ${duration.toFixed(2)}ms - ${error.message}`);
        return { success: false, duration, error: error.message };
    }
}

// 模拟PDF预览请求
async function testPdfPreview(documentId, fileName) {
    console.log(`\n🔍 测试PDF预览: ${fileName} (${documentId})`);
    
    const totalStart = performance.now();
    const steps = {};
    
    try {
        // 步骤1: 检查文档是否存在
        let stepStart = performance.now();
        const docResponse = await axios.get(`${BACKEND_BASE_URL}/api/documents/${documentId}`);
        steps.documentCheck = performance.now() - stepStart;
        console.log(`  ✓ 文档检查: ${steps.documentCheck.toFixed(2)}ms`);
        
        // 步骤2: 获取PDF原始数据 (这是最关键的步骤)
        stepStart = performance.now();
        const rawResponse = await axios.get(`${BACKEND_BASE_URL}/api/documents/${documentId}/raw`, {
            responseType: 'arraybuffer',
            timeout: 10000 // 10秒超时
        });
        steps.rawDataFetch = performance.now() - stepStart;
        console.log(`  ✓ PDF数据获取: ${steps.rawDataFetch.toFixed(2)}ms (${(rawResponse.data.byteLength / 1024 / 1024).toFixed(2)} MB)`);
        
        // 步骤3: 模拟Blob转换 (前端处理)
        stepStart = performance.now();
        // 这里模拟URL.createObjectURL的开销
        const blob = new Buffer.from(rawResponse.data);
        steps.blobConversion = performance.now() - stepStart;
        console.log(`  ✓ Blob转换: ${steps.blobConversion.toFixed(2)}ms`);
        
        const totalDuration = performance.now() - totalStart;
        
        return {
            success: true,
            fileName,
            documentId,
            totalDuration,
            steps,
            fileSize: rawResponse.data.byteLength,
            breakdown: {
                documentCheck: ((steps.documentCheck / totalDuration) * 100).toFixed(1) + '%',
                rawDataFetch: ((steps.rawDataFetch / totalDuration) * 100).toFixed(1) + '%',
                blobConversion: ((steps.blobConversion / totalDuration) * 100).toFixed(1) + '%'
            }
        };
        
    } catch (error) {
        const totalDuration = performance.now() - totalStart;
        console.error(`  ❌ 预览失败: ${error.message}`);
        
        return {
            success: false,
            fileName,
            documentId,
            totalDuration,
            error: error.message,
            steps
        };
    }
}

// 分析网络连接
async function analyzeNetworkConnection() {
    console.log('\n🌐 分析网络连接...');
    
    const tests = [
        { name: '前端连接', url: FRONTEND_BASE_URL },
        { name: '后端连接', url: `${BACKEND_BASE_URL}/api/health` },
        { name: '后端文档路由', url: `${BACKEND_BASE_URL}/api/documents` }
    ];
    
    const results = {};
    
    for (const test of tests) {
        const start = performance.now();
        try {
            await axios.get(test.url, { timeout: 5000 });
            const duration = performance.now() - start;
            results[test.name] = { success: true, duration };
            console.log(`  ✓ ${test.name}: ${duration.toFixed(2)}ms`);
        } catch (error) {
            const duration = performance.now() - start;
            results[test.name] = { success: false, duration, error: error.message };
            console.log(`  ❌ ${test.name}: ${duration.toFixed(2)}ms - ${error.message}`);
        }
    }
    
    return results;
}

// 生成性能报告
function generateReport(results) {
    console.log('\n📈 性能分析报告');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (successful.length > 0) {
        const avgTotal = successful.reduce((sum, r) => sum + r.totalDuration, 0) / successful.length;
        const avgRawFetch = successful.reduce((sum, r) => sum + (r.steps.rawDataFetch || 0), 0) / successful.length;
        const avgFileSize = successful.reduce((sum, r) => sum + r.fileSize, 0) / successful.length;
        
        console.log(`✅ 成功测试: ${successful.length}/${results.length}`);
        console.log(`⏱️  平均总时间: ${avgTotal.toFixed(2)}ms`);
        console.log(`🔄 平均数据获取时间: ${avgRawFetch.toFixed(2)}ms (${((avgRawFetch/avgTotal)*100).toFixed(1)}%)`);
        console.log(`📁 平均文件大小: ${(avgFileSize / 1024 / 1024).toFixed(2)} MB`);
        
        console.log('\n🎯 性能瓶颈分析:');
        if (avgRawFetch > avgTotal * 0.8) {
            console.log('  ⚠️  主要瓶颈: 后端PDF数据传输 (占用80%+时间)');
            console.log('  💡 优化建议: 实施PDF流式传输或缓存策略');
        } else if (avgRawFetch > avgTotal * 0.6) {
            console.log('  ⚠️  主要瓶颈: 网络传输 (占用60%+时间)');
            console.log('  💡 优化建议: 启用压缩传输或实施预加载');
        } else {
            console.log('  ✅ 瓶颈分布相对均匀');
            console.log('  💡 建议: 关注前端渲染优化');
        }
        
        // 个别测试详情
        console.log('\n📊 详细测试结果:');
        successful.forEach((result, index) => {
            console.log(`  ${index + 1}. ${result.fileName}:`);
            console.log(`     总时间: ${result.totalDuration.toFixed(2)}ms`);
            console.log(`     文档检查: ${result.breakdown.documentCheck}`);
            console.log(`     数据获取: ${result.breakdown.rawDataFetch}`);
            console.log(`     Blob转换: ${result.breakdown.blobConversion}`);
        });
    }
    
    if (failed.length > 0) {
        console.log(`\n❌ 失败测试: ${failed.length}/${results.length}`);
        failed.forEach((result, index) => {
            console.log(`  ${index + 1}. ${result.fileName}: ${result.error}`);
        });
    }
    
    console.log('\n🔧 优化建议:');
    console.log('1. 如果数据获取时间过长(>3s):');
    console.log('   - 检查后端文件系统IO性能');
    console.log('   - 实施PDF分块传输');
    console.log('   - 添加后端缓存层');
    console.log('2. 如果总时间过长但数据获取正常:');
    console.log('   - 优化前端Blob处理');
    console.log('   - 使用Web Workers处理大文件');
    console.log('   - 实施预览缓存机制');
}

// 主函数
async function main() {
    console.log('🚀 PDF预览性能监测开始');
    console.log(`测试配置: ${TEST_ITERATIONS}轮次, 后端: ${BACKEND_BASE_URL}`);
    
    // 分析网络连接
    await analyzeNetworkConnection();
    
    // 获取文档列表
    console.log('\n📋 获取测试文档...');
    const documentsResult = await fetchDocuments();
    
    if (!documentsResult.success || !documentsResult.documents.length) {
        console.error('❌ 无法获取PDF文档进行测试');
        return;
    }
    
    console.log(`✅ 找到 ${documentsResult.documents.length} 个PDF文档`);
    
    // 执行PDF预览测试
    const allResults = [];
    
    for (let iteration = 1; iteration <= TEST_ITERATIONS; iteration++) {
        console.log(`\n🔄 执行第 ${iteration} 轮测试...`);
        
        for (const doc of documentsResult.documents.slice(0, 3)) { // 最多测试3个文档
            const result = await testPdfPreview(doc.id, doc.fileName);
            allResults.push(result);
            
            // 轮次间间隔，避免缓存影响
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // 生成报告
    generateReport(allResults);
    
    console.log('\n✅ 性能监测完成');
}

// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('❌ 未处理的Promise拒绝:', error.message);
    process.exit(1);
});

// 启动监测
main().catch(console.error);