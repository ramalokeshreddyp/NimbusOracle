import {
  WeatherReported as WeatherReportedEvent,
  WeatherRequested as WeatherRequestedEvent
} from "../../generated/WeatherOracle/WeatherOracle";
import { WeatherReport, WeatherRequest } from "../../generated/schema";

export function handleWeatherRequested(event: WeatherRequestedEvent): void {
  const request = new WeatherRequest(event.params.requestId);
  request.city = event.params.city;
  request.requester = event.params.requester;
  request.requestedAt = event.block.timestamp;
  request.save();
}

export function handleWeatherReported(event: WeatherReportedEvent): void {
  const id = event.params.requestId;
  let report = WeatherReport.load(id);

  if (report == null) {
    report = new WeatherReport(id);
  }

  const request = WeatherRequest.load(id);
  report.city = event.params.city;
  report.temperature = event.params.temperature.toI32();
  report.description = event.params.description;
  report.timestamp = event.params.timestamp;
  report.requester = request ? request.requester : event.transaction.from;

  report.save();
}