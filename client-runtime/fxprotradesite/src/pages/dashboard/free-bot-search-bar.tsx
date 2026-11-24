import React,{useEffect,useState} from 'react';
import {observer} from 'mobx-react-lite';
import {DBOT_TABS} from '@/constants/bot-contents';
import {useStore} from '@/hooks/useStore';
type Bot={file:string;title:string;description:string};
const FreeBotSearchBar=observer(({className}:{className?:string})=>{
 const {dashboard,load_modal}=useStore();const [bots,setBots]=useState<Bot[]>([]),[query,setQuery]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{fetch('/bot-catalog.json').then(r=>{if(!r.ok)throw new Error('Library unavailable');return r.json()}).then(setBots).catch(()=>setMessage('The free bot library could not load. Try again later.'))},[]);
 async function load(bot:Bot){try{const response=await fetch('/'+encodeURI(bot.file));if(!response.ok)throw new Error('Bot could not load');const xml=await response.text();dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);await load_modal.loadStrategyToBuilder({id:'free-'+Date.now(),xml,name:bot.title,save_type:'local',timestamp:Date.now()});setQuery('');setMessage('Bot loaded. Review the settings before pressing Run.')}catch(error){setMessage((error as Error).message)}}
 return <section className={className}><label>Find a free bot<input value={query} onChange={e=>setQuery(e.target.value)} placeholder='Search by name or strategy' /></label><p role='status'>{message}</p>{query.trim()&&<div>{bots.filter(bot=>(bot.title+' '+bot.description).toLowerCase().includes(query.trim().toLowerCase())).slice(0,8).map(bot=><button key={bot.file} onClick={()=>load(bot)}>{bot.title}</button>)}</div>}</section>;
});
export default FreeBotSearchBar;
