export const getCandleRemainingTime = (setRemainingTime) => {
  const startTime = new Date();
  const endTime = new Date();
  startTime.setHours(9, 15, 0, 0);
  endTime.setHours(15, 30, 0, 0);

  const calculateRemainingTime = () => {
    const now = new Date();

    if (now >= startTime && now <= endTime) {
      const marketStart = new Date(now);
      marketStart.setHours(9, 15, 0, 0);

      const elapsedTime = now.getTime() - marketStart.getTime();
      const elapsedCandles = Math.floor(elapsedTime / (3 * 60 * 1000));

      const currentCandleStart = new Date(
        marketStart.getTime() + elapsedCandles * 3 * 60 * 1000
      );
      const currentCandleEnd = new Date(
        currentCandleStart.getTime() + 3 * 60 * 1000
      );

      const remainingMillis = currentCandleEnd.getTime() - now.getTime();
      const remainingSeconds = Math.ceil(remainingMillis / 1000);
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;

      setRemainingTime(`${minutes}:${seconds < 10 ? "0" : ""}${seconds}`);
    } else {
      setRemainingTime(null);
    }
  };

  calculateRemainingTime();

  const interval = setInterval(calculateRemainingTime, 1000);

  return () => clearInterval(interval);
};
