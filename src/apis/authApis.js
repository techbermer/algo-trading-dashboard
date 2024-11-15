import { BASE_URL, API_KEY, REDIRECT_URI, AUTH_URL, LOGOUT } from "../config";

export const generateAuthUrl = () => {
  const client_id = encodeURIComponent(API_KEY);
  const redirect_uri = encodeURIComponent(REDIRECT_URI);
  return `${AUTH_URL}${client_id}&redirect_uri=${redirect_uri}`;
};

export async function getAccessToken({ authorizationCode }) {
  const response = await fetch(
    `${BASE_URL}api/v1/authentication/get_access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: authorizationCode }),
    }
  );
  console.log("hi", response);
  return response.json();
}

export async function logout() {
  const response = await fetch(`${BASE_URL}${LOGOUT}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return response;
}
