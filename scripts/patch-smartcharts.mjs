import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const require=createRequire(import.meta.url);
const manifest=require.resolve('@deriv-com/smartcharts-champion/package.json');
const version=JSON.parse(await readFile(manifest,'utf8')).version;
if(version!=='1.10.8')throw new Error('Review the SmartCharts trading-times fix when upgrading.');
const path=resolve(dirname(manifest),'dist/smartcharts.js');
const source=await readFile(path,'utf8');
const before='this.lastUpdateDate=this._serverTime.getLocalDate().toISOString().substring(0,10),!this._tradingTimesMap&&this._shouldFetchTradingTimes';
// v1.10.8 leaves initialization pending when the host supplied trading times before initialize().
const after=before.replace(',!this._tradingTimesMap',',this._params.tradingTimes&&this._calculatingTradingTime(this._params.tradingTimes),this._tradingTimesMap&&this.tradingTimesPromise.resolve(),!this._tradingTimesMap');
const previous=before.replace(',!this._tradingTimesMap',',this._tradingTimesMap&&this.tradingTimesPromise.resolve(),!this._tradingTimesMap');
if(!source.includes(after)){
  const target=source.includes(previous)?previous:before;
  if(source.split(target).length!==2)throw new Error('SmartCharts fix no longer matches its pinned source.');
  await writeFile(path,source.replace(target,after));
}
const initialize='async initialize(){if(await this._serverTime.init(this._api,()=>{"function"==typeof this.timeUpdateCallback&&this.timeUpdateCallback()}),this.isInitialized)return this.tradingTimesPromise;';
const initializeWithHostData='async initialize(){if(this._params.tradingTimes){this._calculatingTradingTime(this._params.tradingTimes);this.isInitialized=!0;this.tradingTimesPromise.resolve();return this.tradingTimesPromise}if(await this._serverTime.init(this._api,()=>{"function"==typeof this.timeUpdateCallback&&this.timeUpdateCallback()}),this.isInitialized)return this.tradingTimesPromise;';
if(!source.includes(initializeWithHostData)){
  const current=await readFile(path,'utf8');
  if(current.split(initialize).length!==2)throw new Error('SmartCharts host-feed fix no longer matches its pinned source.');
  await writeFile(path,current.replace(initialize,initializeWithHostData));
}
