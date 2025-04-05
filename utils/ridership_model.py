import pandas as pd
import requests
from datetime import datetime, timedelta
from statsmodels.tsa.ar_model import AutoReg
import pickle


def generate_data(timeframe):
    manhattan_stops = pd.read_csv("backend/utils/data/manhattan_stops.csv")
    manhattan_unique = manhattan_stops["Stop Name"].unique()
    current_time = datetime.now()

    current_time = current_time - timedelta(hours=380)

    while True:
        current_time = current_time - timedelta(hours=1)
        formatted_time = current_time.strftime("%Y-%m-%dT%H:00:00")
        url = (
            "https://data.ny.gov/resource/wujg-7c2s.json?$where=transit_timestamp >= '"
            + formatted_time
            + "'"
        )
        response = requests.get(url)
        data = response.json()
        df_sub = pd.DataFrame.from_dict(data)
        if len(df_sub) > 0:
            break

    for j in range(timeframe):
        current_time = current_time - timedelta(hours=1)
        formatted_time = current_time.strftime("%Y-%m-%dT%H:00:00")
        url = (
            "https://data.ny.gov/resource/wujg-7c2s.json?$where=transit_timestamp >= '"
            + formatted_time
            + "'"
        )
        response = requests.get(url)
        data = response.json()
        df_temp = pd.DataFrame.from_dict(data)
        df_sub = pd.concat([df_sub, df_temp], axis=0)

    filtered_df = df_sub[
        ["station_complex", "ridership", "transfers", "transit_timestamp"]
    ]

    expanded_data = filtered_df.drop("station_complex", axis=1).join(
        filtered_df["station_complex"]
        .str.split("/")
        .explode("station_complex")
        .reset_index(drop=True)
    )
    expanded_data["station_complex"] = expanded_data["station_complex"].str.replace(
        r"\s*\([^)]+\)", "", regex=True
    )
    expanded_data["ridership"] = pd.to_numeric(
        expanded_data["ridership"], errors="coerce"
    )
    expanded_data["transfers"] = pd.to_numeric(
        expanded_data["transfers"], errors="coerce"
    )
    expanded_data = expanded_data.dropna(subset=["ridership", "transfers"])

    consolidated_data = (
        expanded_data.groupby(["transit_timestamp", "station_complex"])
        .agg({"ridership": "mean", "transfers": "mean"})
        .reset_index()
    )

    consolidated_data = consolidated_data.loc[
        consolidated_data["station_complex"].isin(manhattan_unique)
    ]

    return consolidated_data


def generate_model():

    models_dict = {}
    consolidated_data = generate_data(30)

    for station in consolidated_data["station_complex"].unique():
        station_df = consolidated_data[consolidated_data["station_complex"] == station]
        station_df = station_df.sort_values("transit_timestamp")
        station_df["transit_timestamp"] = pd.to_datetime(
            station_df["transit_timestamp"]
        )
        station_df = station_df.dropna(subset=["ridership"])
        station_df.reset_index(inplace=True, drop=True)
        model = AutoReg(station_df["ridership"], lags=3)
        fitted_model = model.fit()
        models_dict[station] = fitted_model.params

    with open("models.pickle", "wb") as handle:
        pickle.dump(models_dict, handle)


if __name__ == "__main__":
    generate_model()
