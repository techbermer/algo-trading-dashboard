export const upstoxDataInterval = "1minute";
export const today = new Date().toISOString().split("T")[0];
const oneWeekAgo = new Date();
oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
export const fromDate = oneWeekAgo.toISOString().split("T")[0];
