import { gql, useQuery } from "@apollo/client";

const GET_WEATHER_REPORTS = gql`
  query GetWeatherReports {
    weatherReports(orderBy: timestamp, orderDirection: desc, first: 20) {
      id
      city
      temperature
      description
      timestamp
      requester
    }
  }
`;

function WeatherReportsList() {
  const { data, loading, error } = useQuery(GET_WEATHER_REPORTS, {
    pollInterval: 10000
  });

  return (
    <section style={{ marginTop: 20 }}>
      <h2>Historical Weather Reports</h2>
      {loading && <p>Loading reports...</p>}
      {error && <p style={{ color: "crimson" }}>Failed to load reports: {error.message}</p>}

      {!loading && !error && data?.weatherReports?.length === 0 && <p>No reports indexed yet.</p>}

      {!loading && !error && data?.weatherReports?.length > 0 && (
        <ul>
          {data.weatherReports.map((report) => (
            <li key={report.id} style={{ marginBottom: 10 }}>
              <strong>{report.city}</strong> — {report.temperature}°C — {report.description}
              <br />
              Requester: {report.requester}
              <br />
              Time: {new Date(Number(report.timestamp) * 1000).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default WeatherReportsList;