import { API_KEY, API_SECRET, REDIRECT_URI, AUTH_URL } from "../config";

export const generateAuthUrl = () => {
  const client_id = encodeURIComponent(API_KEY);
  const redirect_uri = encodeURIComponent(REDIRECT_URI);
  return `${AUTH_URL}${client_id}&redirect_uri=${redirect_uri}`;
};

export async function getAccessToken({ authorizationCode }) {
  const response = await fetch(
    "https://api.upstox.com/v2/login/authorization/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: authorizationCode,
        client_id: API_KEY,
        client_secret: API_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    }
  );

  return response.json();
}
