#!/usr/bin/env node

/**
 * 从 LunaTV-config 仓库同步 API 配置
 * 使用方式: node scripts/sync-api-config.js [source]
 * source: jin18 (默认) | jingjian | full
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 配置源映射
const SOURCE_FILES = {
  jin18: 'jin18.json',       // 精简版（无成人内容）
  jingjian: 'jingjian.json', // 精简版+成人内容
  full: 'LunaTV-config.json' // 完整版
};

const LUNATV_CONFIG_BASE = 'https://raw.githubusercontent.com/hafrey1/LunaTV-config/main/';
const LOCAL_CONFIG_PATH = path.join(__dirname, '../config.json');

/**
 * 从 URL 获取 JSON 数据
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`解析 JSON 失败: ${err.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 合并配置
 * 策略：
 * 1. 保留本地的 cache_time 和 custom_category
 * 2. 使用远程的 api_site，但保留本地自定义的 API（通过 _local: true 标记）
 */
function mergeConfig(localConfig, remoteConfig) {
  const merged = {
    cache_time: localConfig.cache_time || remoteConfig.cache_time,
    api_site: {}
  };
  
  // 添加远程的 API 站点
  if (remoteConfig.api_site) {
    Object.assign(merged.api_site, remoteConfig.api_site);
  }
  
  // 保留本地标记为 _local 的自定义 API
  if (localConfig.api_site) {
    Object.entries(localConfig.api_site).forEach(([key, value]) => {
      if (value._local === true) {
        merged.api_site[key] = value;
        console.log(`  ✓ 保留本地自定义 API: ${key} (${value.name})`);
      }
    });
  }
  
  // 保留本地的自定义分类
  if (localConfig.custom_category) {
    merged.custom_category = localConfig.custom_category;
  }
  
  return merged;
}

/**
 * 主函数
 */
async function main() {
  const source = process.argv[2] || 'jin18';
  
  if (!SOURCE_FILES[source]) {
    console.error(`❌ 无效的配置源: ${source}`);
    console.error(`   可用选项: ${Object.keys(SOURCE_FILES).join(', ')}`);
    process.exit(1);
  }
  
  const sourceFile = SOURCE_FILES[source];
  const remoteUrl = LUNATV_CONFIG_BASE + sourceFile;
  
  console.log(`\n🔄 正在从 LunaTV-config 同步配置...`);
  console.log(`📦 配置源: ${source} (${sourceFile})`);
  console.log(`🌐 远程地址: ${remoteUrl}\n`);
  
  try {
    // 读取本地配置
    let localConfig = {};
    if (fs.existsSync(LOCAL_CONFIG_PATH)) {
      localConfig = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf-8'));
      console.log('✓ 读取本地配置');
    } else {
      console.log('⚠ 本地配置不存在，将创建新配置');
    }
    
    // 获取远程配置
    console.log('⏳ 正在获取远程配置...');
    const remoteConfig = await fetchJSON(remoteUrl);
    console.log('✓ 获取远程配置成功');
    
    const remoteApiCount = Object.keys(remoteConfig.api_site || {}).length;
    console.log(`  远程 API 数量: ${remoteApiCount}\n`);
    
    // 合并配置
    console.log('🔀 正在合并配置...');
    const mergedConfig = mergeConfig(localConfig, remoteConfig);
    
    const finalApiCount = Object.keys(mergedConfig.api_site).length;
    console.log(`✓ 合并完成`);
    console.log(`  最终 API 数量: ${finalApiCount}\n`);
    
    // 写入本地配置
    fs.writeFileSync(
      LOCAL_CONFIG_PATH,
      JSON.stringify(mergedConfig, null, 2) + '\n',
      'utf-8'
    );
    console.log('✅ 配置已更新到 config.json\n');
    
    // 统计信息
    console.log('📊 更新统计:');
    console.log(`  • 同步配置源: ${source}`);
    console.log(`  • 远程 API 数: ${remoteApiCount}`);
    console.log(`  • 最终 API 数: ${finalApiCount}`);
    console.log(`  • 新增/更新: ${finalApiCount - (Object.keys(localConfig.api_site || {}).length - Object.values(localConfig.api_site || {}).filter(v => v._local).length)}`);
    
  } catch (error) {
    console.error(`\n❌ 同步失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = { fetchJSON, mergeConfig };
