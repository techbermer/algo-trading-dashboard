import {
  BASE_URL,
  START_MARKET,
  STOP_MARKET,
  HISTORY_DATA,
  TODAY_DATA,
} from "../config";
import { getToken } from "../services/accessTokenHandler";
import { upstoxDataInterval, today, fromDate } from "../constants/constants";

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

export async function startMarket({ selectedMarketAndLot }) {
  const response = await fetch(`${BASE_URL}${START_MARKET}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: selectedMarketAndLot,
  });

  return response;
}

export async function stopMarket() {
  const response = await fetch(`${BASE_URL}${STOP_MARKET}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return response;
}
