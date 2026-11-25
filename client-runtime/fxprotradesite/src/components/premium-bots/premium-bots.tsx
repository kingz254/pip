import {useEffect,useState} from 'react';
import {useStore} from '@/hooks/useStore';
import {getSelectedAccount} from '@/pipforge/session';
import {DBOT_TABS} from '@/constants/bot-contents';
import PremiumCopy from './premium-copy';

type Bot={id:string;name:string;execution_ready:boolean;unlocked:boolean};
export default function PremiumBots(){
 const {load_modal,dashboard}=useStore();const [bots,setBots]=useState<Bot[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function request(id?:string){const account=getSelectedAccount();if(!account)throw new Error('Log in to Deriv and choose your account first.');const query=new URLSearchParams({account_id:account.account_id});if(id)query.set('bot_id',id);const response=await fetch('/api/deriv/premium-bots?'+query,{credentials:'same-origin',cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Premium library unavailable');return result;}
 async function refresh(){setMessage('Checking your account access…');try{const result=await request();setBots(result.data);setMessage('Use the same Deriv account ID you gave the site owner. Contact the owner to purchase or unlock a bot.')}catch(error){setBots([]);setMessage((error as Error).message)}}
 useEffect(()=>{refresh();window.addEventListener('pf:account-changed',refresh);return()=>window.removeEventListener('pf:account-changed',refresh)},[]);
 async function load(bot:Bot){if(busy)return;setBusy(true);try{const result=await request(bot.id);dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);const deadline=Date.now()+15000;while((!window.Blockly?.derivWorkspace)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));if(!window.Blockly?.derivWorkspace)throw new Error('Bot Builder is not ready. Try again.');await load_modal.loadStrategyToBuilder({id:'premium-'+Date.now(),xml:result.xml,name:bot.name,save_type:'local',timestamp:Date.now()});setMessage('Bot loaded. Review its settings and press Run.')}catch(error){setMessage((error as Error).message)}finally{setBusy(false)}}
 return (
  <section className='pf-premium-bots' style={{ padding: '20px', color: 'var(--text-general)', minHeight: '100%', overflow: 'auto' }}>
   <h1>Premium bots</h1>
   <p>Paid access is managed by this site’s owner. Bots can lose their full stake; try demo first.</p>
   <button className='pf-premium-bots__action' onClick={refresh} disabled={busy}>Refresh access</button>
   <p role='status'>{message}</p>
   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(240px,100%),1fr))', gap: '14px' }}>
    {bots.map(bot => (
     <article key={bot.id} style={{ padding: '18px', border: '1px solid var(--pf-client-edge)', borderRadius: '14px', background: 'var(--pf-client-glass)', backdropFilter: 'blur(var(--pf-client-blur))' }}>
      <h2>{bot.name}</h2>
      <p>{!bot.execution_ready ? 'Compatibility review in progress' : bot.unlocked ? 'Unlocked for your account' : 'Locked — contact the site owner'}</p>
      <button className='pf-premium-bots__action' disabled={busy || !bot.unlocked || !bot.execution_ready} onClick={() => load(bot)}>{bot.unlocked ? 'Load bot' : 'Locked'}</button>
     </article>
    ))}
   </div>
   <PremiumCopy />
  </section>
 );
}
