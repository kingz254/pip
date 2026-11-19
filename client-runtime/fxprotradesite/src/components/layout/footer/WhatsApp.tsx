import { LegacyWhatsappIcon } from '@deriv/quill-icons/Legacy';
import { useTranslations } from '@deriv-com/translations';
import { Tooltip } from '@deriv-com/ui';
import { URLConstants } from '@deriv-com/utils';

const WhatsApp = () => {
    const { localize } = useTranslations();

    return (
        <Tooltip
            as='a'
            className='app-footer__icon'
            href='https://wa.me/254735525483'
            target='_blank'
            tooltipContent={localize('WhatsApp')}
        >
            <LegacyWhatsappIcon iconSize='xs' />
        </Tooltip>
    );
};

export default WhatsApp;
