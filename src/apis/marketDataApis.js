import { HISTORY_DATA, TODAY_DATA } from "../config";
import { upstoxDataInterval, today, fromDate } from "../constants/constants";
import { getToken } from "../services/accessTokenHandler";

export async function getHistoricalData({ instrumentKey }) {
  const response = await fetch(
    `${HISTORY_DATA}${instrumentKey}/${upstoxDataInterval}/${today}/${fromDate}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
    }
  );

  return response.json();
}

export async function getTodayData({ instrumentKey }) {
  const response = await fetch(
    `${TODAY_DATA}${instrumentKey}/${upstoxDataInterval}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
    }
  );

  return response.json();
}
