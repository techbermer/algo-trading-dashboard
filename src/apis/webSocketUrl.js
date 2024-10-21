import { WEBSOCKET_URL } from "../config";
import { getToken } from "../services/accessTokenHandler";

export const getUrl = async () => {
  let headers = {
    "Content-type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };

  const response = await fetch(WEBSOCKET_URL, {
    method: "GET",
    headers: headers,
  });

  if (response.status === 401) {
    throw new Error("Token expired");
  }

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  const res = await response.json();
  return res.data.authorizedRedirectUri;
};
