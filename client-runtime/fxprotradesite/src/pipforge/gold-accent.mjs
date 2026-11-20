const gold=/#(?:b1913e|b99425|a38124|bea421|ceb159|dba80d|c7b813|f3b408|dfb81b|b48a0b|ba9d47|c19f3b|a0802e)([0-9a-f]{2})?\b/gi;
export function replaceGold(value) {
 return value.replace(gold,(_,alpha)=>alpha?`color-mix(in srgb,var(--pf-client-accent) ${Math.round(parseInt(alpha,16)/255*100)}%,transparent)`:'var(--pf-client-accent)')
 .replace(/rgba?\(\s*(177[, ]+145[, ]+62|185[, ]+148[, ]+37)(?:\s*[,/]\s*([\d.]+))?\s*\)/gi,(_,rgb,alpha)=>alpha?`color-mix(in srgb,var(--pf-client-accent) ${Number(alpha)*100}%,transparent)`:'var(--pf-client-accent)');
}
