# NBN Atlas Occurrence Data Schema

This document describes the occurrence data structure returned by the NBN Atlas API.

## Full API Response Schema

Each occurrence record from the NBN Atlas API has this full structure:

```json
{
  "uuid": "f3b607a7-3e26-4f91-ace7-37886d86f292",
  "occurrenceID": "NHMSYS00005304591905-05-22SK10",
  "raw_institutionCode": "BTO",
  "taxonConceptID": "NHMSYS0000530459",
  "eventDate": -2039040000000,
  "scientificName": "Lullula arborea",
  "vernacularName": "Woodlark",
  "taxonRank": "species",
  "taxonRankID": 7000,
  "country": "United Kingdom of Great Britain and Northern Ireland",
  "kingdom": "Animalia",
  "phylum": "Chordata",
  "classs": "Aves",
  "order": "Passeriformes",
  "family": "Alaudidae",
  "genus": "Lullula",
  "genusGuid": "NHMSYS0000530458",
  "species": "Lullula arborea",
  "speciesGuid": "NHMSYS0000530459",
  "stateProvince": "England",
  "decimalLatitude": 52.642537,
  "decimalLongitude": -1.779755,
  "coordinateUncertaintyInMeters": 7071.1,
  "year": 1905,
  "month": "05",
  "basisOfRecord": "HUMAN_OBSERVATION",
  "dataProviderUid": "dp29",
  "dataProviderName": "British Trust for Ornithology",
  "dataResourceUid": "dr528",
  "dataResourceName": "Birds (BTO+partners) to 2005",
  "assertions": [
    "MISSING_TAXONRANK",
    "COUNTRY_DERIVED_FROM_COORDINATES",
    "MISSING_GEOREFERENCE_DATE"
  ],
  "speciesGroups": ["Animals", "Birds"],
  "spatiallyValid": true,
  "recordedBy": ["Withheld"],
  "collectors": ["Withheld"],
  "raw_scientificName": "Lullula arborea",
  "raw_basisOfRecord": "HumanObservation",
  "license": "CC-BY-NC",
  "identificationVerificationStatus": "Accepted - considered correct",
  "sensitive": "alreadyGeneralised",
  "gridReference": "SK10",
  "vitality": "alive",
  "raw_taxonId": "NHMSYS0000530459",
  "geospatialKosher": "true",
  "latLong": "52.642537,-1.779755",
  "point1": "53,-2",
  "point01": "52.6,-1.8",
  "point001": "52.64,-1.78",
  "point0001": "52.643,-1.78",
  "point00001": "52.6425,-1.7798",
  "collector": ["Withheld"],
  "namesLsid": "Lullula arborea|NHMSYS0000530459|Woodlark|Animalia|Alaudidae",
  "left": 44815,
  "right": 44817
}
```

## Simplified Schema (Used by App)

The server simplifies each occurrence to reduce payload size:

```json
{
  "year": 1905,
  "month": "05",
  "decimalLatitude": 52.642537,
  "decimalLongitude": -1.779755,
  "stateProvince": "England",
  "basisOfRecord": "HUMAN_OBSERVATION",
  "scientificName": "Lullula arborea",
  "vernacularName": "Woodlark",
  "gridReference": "SK10"
}
```

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `year` | number | Year of the observation |
| `month` | string | Month (01-12) |
| `decimalLatitude` | number | Latitude in decimal degrees (WGS84) |
| `decimalLongitude` | number | Longitude in decimal degrees (WGS84) |
| `stateProvince` | string | Region/county name (e.g., "England", "Scotland") |
| `basisOfRecord` | string | Type of observation (e.g., "HUMAN_OBSERVATION") |
| `scientificName` | string | Scientific species name |
| `vernacularName` | string | Common name |
| `gridReference` | string | British/Irish grid reference (e.g., "SK10", "TQ1234") |

## Notes

- The server filters all queries to UK & Ireland only
- Grid references use the British National Grid (OSGB) or Irish Grid systems
- Latitude/longitude may be null if only grid reference is available
- The NBN Atlas API has a 5000 offset limit - the server handles this via recursive time drilling (year → month → day)
- Data is licensed under CC BY 4.0 from the NBN Atlas
