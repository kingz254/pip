import ChangeTheme from './ChangeTheme';
import NetworkStatus from './NetworkStatus';
import ClientSocialProfiles from '../client-social-profiles';
import { DisclaimerButton } from '../../disclaimer';
import './footer.scss';

const Footer = () => {
    return (
        <footer className='app-footer'>
            <NetworkStatus />
            <ClientSocialProfiles place='footer' />
            <DisclaimerButton />
            <ChangeTheme />
        </footer>
    );
};

export default Footer;
