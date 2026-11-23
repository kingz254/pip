import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import TradeAnimation from '@/components/trade-animation';
import { useDevice } from '@deriv-com/ui';

const RunStrategy = observer(() => {
    const [fast, setFast] = useState(() => localStorage.getItem('pf_fast_trading') === 'true');
    const { run_panel } = useStore();
    const { isDesktop } = useDevice();
    return <div className='toolbar__section' data-testid='dt_run_strategy'>
        {(!run_panel.is_drawer_open || isDesktop) && <button className='pf-tray-toggle' type='button' aria-label='Toggle trading results' aria-expanded={run_panel.is_drawer_open} onClick={() => run_panel.toggleDrawer(!run_panel.is_drawer_open)}>
            <svg viewBox='0 0 24 24' aria-hidden='true'><path d={run_panel.is_drawer_open ? 'm5 8 7 7 7-7' : 'm5 16 7-7 7 7'} /></svg>
        </button>}
        <TradeAnimation className='toolbar__animation' />
        <label className='pf-fast-trading'>
            <span>{fast ? 'Fast trading' : 'Normal speed'}</span>
            <input type='checkbox' role='switch' checked={fast} onChange={event => {
                setFast(event.target.checked);
                localStorage.setItem('pf_fast_trading', String(event.target.checked));
            }} aria-label='Fast trading: remove the pause between settled bot contracts' />
        </label>
    </div>;
});
export default RunStrategy;
