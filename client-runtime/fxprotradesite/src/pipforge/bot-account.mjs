// Bot startup uses the selected account, never a browser-held provider token.
export async function initializeBotAccount(api, accountId, getAccount, getGeneration) {
    const generation=getGeneration();
    const current=()=>api.is_authorized && getAccount()?.account_id===accountId && generation===getGeneration();
    if (!current()) throw new Error('Your account is connecting. Wait for the connection before running the bot.');
    const response=await api.api.send({balance:1});
    if (!current()) throw new Error('Account changed before the bot was ready.');
    if(response.error || !response.balance || !Number.isFinite(Number(response.balance.balance)))throw new Error(response.error?.message || 'Could not read the selected account balance.');
    if(response.balance.loginid!==accountId || response.balance.currency!==getAccount().currency)throw new Error('The balance response does not match the selected account.');
    return {...api.account_info,loginid:accountId,balance:Number(response.balance.balance),currency:response.balance.currency};
}
