export const getUrl = async (token) => {
  const apiUrl = "https://api-v2.upstox.com/feed/market-data-feed/authorize";
  let headers = {
    "Content-type": "application/json",
    Authorization: "Bearer " + token,
  };

  const response = await fetch(apiUrl, {
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
