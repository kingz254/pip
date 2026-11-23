import LoadingFrame from '../components/loader/loading-frame';
export default function TradingTemplate({app}:{app:'digits'|'accumulators'|'rise-fall'}) {
 return <LoadingFrame className='pf-trading-template' title={app==='rise-fall'?'Rise / Fall trading':app==='digits'?'Digits trading':'Accumulators trading'} src={'/apps/'+app+'/'} style={{width:'100%',height:'100%',minHeight:400,border:0,colorScheme:document.documentElement.dataset.pfTheme==='light'?'light':'dark'}} />;
}
