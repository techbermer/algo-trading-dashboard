const CandleDataRow = ({ keyName, value, isBullish }) => (
  <p>
    <span style={{ color: "white" }}>{keyName}:</span>{" "}
    <span
      style={{
        color: isBullish ? "#329981" : "#E83341",
      }}
    >
      {value?.toLocaleString("en-IN")}
    </span>
  </p>
);

export const CurrentCandleData = ({ currentCandle }) => {
  const isBullish = currentCandle?.C > currentCandle?.O;

  return (
    <div className="current-candle-data">
      <CandleDataRow
        keyName="O"
        value={currentCandle?.O}
        isBullish={isBullish}
      />
      <CandleDataRow
        keyName="H"
        value={currentCandle?.H}
        isBullish={isBullish}
      />
      <CandleDataRow
        keyName="L"
        value={currentCandle?.L}
        isBullish={isBullish}
      />
      <CandleDataRow
        keyName="C"
        value={currentCandle?.C}
        isBullish={isBullish}
      />
    </div>
  );
};
