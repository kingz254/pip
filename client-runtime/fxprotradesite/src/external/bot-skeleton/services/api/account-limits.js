export default class AccountLimits {
    async getStakePayoutLimits() {
        // New API limits come from each proposal; Deriv enforces them at quote and purchase time.
        return {};
    }
}
