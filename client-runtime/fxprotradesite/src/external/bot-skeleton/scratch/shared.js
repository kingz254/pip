import filesaver from 'file-saver';
import { config } from '../constants/config';

export const saveAs = ({ data, filename, type }) => {
    const blob = new Blob([data], { type });
    filesaver.saveAs(blob, filename);
};

export const getContractTypeOptions = (contract_type, trade_type) => {
    const trade_types = config().opposites[trade_type.toUpperCase()];

    if (!trade_types) {
        return config().NOT_AVAILABLE_DROPDOWN_OPTIONS;
    }

    const contract_options = trade_types.map(type => Object.entries(type)[0].reverse());

    // When user selected a specific contract, only return the contract type they selected.
    if (contract_type !== 'both') {
        return contract_options.filter(option => option[1] === contract_type);
    }

    return contract_options;
};

export const getAllContractTypeOptions = () => {
    const all_contract_types = [];
    const opposites = config().opposites;
    
    // Iterate through all trade types and collect all contract types
    Object.keys(opposites).forEach(trade_type => {
        const contracts = opposites[trade_type];
        contracts.forEach(contract => {
            const [contract_key, contract_label] = Object.entries(contract)[0];
            // Add contract in format [label, key] for dropdown
            all_contract_types.push([contract_label, contract_key]);
        });
    });
    
    // Remove duplicates and sort alphabetically
    const unique_contracts = all_contract_types.filter((contract, index, self) => 
        index === self.findIndex(c => c[1] === contract[1])
    );
    
    return unique_contracts.sort((a, b) => a[0].localeCompare(b[0]));
};
