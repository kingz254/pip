import { observer } from 'mobx-react-lite';
import useThemeSwitcher from '@/hooks/useThemeSwitcher';
import { LegacyThemeDarkIcon, LegacyThemeLightIcon } from '@deriv/quill-icons/Legacy';



const ChangeTheme = observer(() => {
    const { is_dark_mode_on, toggleTheme } = useThemeSwitcher();


    return (
        <button type='button' aria-label='Change theme'
            className='app-footer__icon pf-theme-toggle'
            onClick={toggleTheme}
        >
            {!is_dark_mode_on ? <LegacyThemeLightIcon iconSize='xs' /> : <LegacyThemeDarkIcon iconSize='xs' />}
        <span>{is_dark_mode_on ? 'Dark' : 'Light'}</span></button>
    );
});

export default ChangeTheme;
