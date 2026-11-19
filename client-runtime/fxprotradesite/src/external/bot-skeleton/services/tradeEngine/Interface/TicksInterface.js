const getTicksInterface = tradeEngine => {
    return {
        getDelayTickValue: (...args) => tradeEngine.getDelayTickValue(...args),
        getCurrentStat: (...args) => tradeEngine.getCurrentStat(...args),
        getStatList: (...args) => tradeEngine.getStatList(...args),
        checkStatComparison: (...args) => tradeEngine.checkStatComparison(...args),
        getLastTick: (...args) => tradeEngine.getLastTick(...args),
        getLastDigit: (...args) => tradeEngine.getLastDigit(...args),
        getTicks: (...args) => tradeEngine.getTicks(...args),
        checkDirection: (...args) => tradeEngine.checkDirection(...args),
        getOhlcFromEnd: (...args) => tradeEngine.getOhlcFromEnd(...args),
        getOhlc: (...args) => tradeEngine.getOhlc(...args),
        getLastDigitList: (...args) => tradeEngine.getLastDigitList(...args),
        getEvenOddPercentage: (...args) => tradeEngine.getEvenOddPercentage(...args),
        getOverUnderPercentage: (...args) => tradeEngine.getOverUnderPercentage(...args),
        getDigitFrequencyRank: (...args) => tradeEngine.getDigitFrequencyRank(...args),
        checkAllSamePattern: (...args) => tradeEngine.checkAllSamePattern(...args),
        checkDigitComparison: (...args) => tradeEngine.checkDigitComparison(...args),
        getRiseFallPercentage: (...args) => tradeEngine.getRiseFallPercentage(...args),
        checkLastTicksDirection: (...args) => tradeEngine.checkLastTicksDirection(...args),
        getDigitPercentage: (...args) => tradeEngine.getDigitPercentage(...args),
        getDigitHighestLowestFrequency: (...args) => tradeEngine.getDigitHighestLowestFrequency(...args),
    };
};

export default getTicksInterface;
