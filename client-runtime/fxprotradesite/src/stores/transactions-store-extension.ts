import { TContractInfo } from '@/components/summary/summary-card.types';

/**
 * Enhances contract information for better display in the transactions panel
 * @param contract_info Original contract info from the API
 * @returns Enhanced contract info with additional display properties
 */
export function enhanceContractInfo(contract_info: TContractInfo): TContractInfo {
    const { contract_type, barrier } = contract_info;

    if (!contract_type) return contract_info;

    const enhanced_info: TContractInfo = { ...contract_info };

    // Add display properties based on contract type
    switch (contract_type) {
        case 'DIGITDIFF':
            enhanced_info.display_name = 'Digit Differs';
            enhanced_info.parameter_type = 'differ_barrier';
            enhanced_info.display_message = `Contract parameter: Differ from ${barrier}`;
            break;
        case 'DIGITOVER':
            enhanced_info.display_name = 'Digit Over';
            enhanced_info.parameter_type = 'over_barrier';
            enhanced_info.display_message = `Contract parameter: Over ${barrier}`;
            break;
        case 'DIGITUNDER':
            enhanced_info.display_name = 'Digit Under';
            enhanced_info.parameter_type = 'under_barrier';
            enhanced_info.display_message = `Contract parameter: Under ${barrier}`;
            break;
        case 'DIGITEVEN':
            enhanced_info.display_name = 'Digit Even';
            enhanced_info.parameter_type = 'even';
            enhanced_info.display_message = 'Contract parameter: Even digit';
            break;
        case 'DIGITODD':
            enhanced_info.display_name = 'Digit Odd';
            enhanced_info.parameter_type = 'odd';
            enhanced_info.display_message = 'Contract parameter: Odd digit';
            break;
        case 'DIGITMAT':
            enhanced_info.display_name = 'Digit Matches';
            enhanced_info.parameter_type = 'match_barrier';
            enhanced_info.display_message = `Contract parameter: Match ${barrier}`;
            break;
    }

    return enhanced_info;
}
