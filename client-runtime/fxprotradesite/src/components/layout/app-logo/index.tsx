import './app-logo.scss';

export const AppLogo = () => {
    const site = window.__PF_SITE_BRANDING__;

    return (
        <a className='app-header__logo' href='/' aria-label={`${site?.name || 'Trading site'} home`}>
            {site?.logo_data ? <img src={site.logo_data} alt='' className='app-header__logo-image' /> : null}
            <span>{site?.name || 'Trading site'}</span>
        </a>
    );
};
