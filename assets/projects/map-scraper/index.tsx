import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

const DATA_ROOT = "/projects/map-scraper/data/"
const USA_CENTER = [37.8, -98.5] as [number, number];

export default function App() {
    const [metadata, setMetadata] = useState<null | {
        name: string,
        slug: string,
        num_locations: number,
        timestamp: string,
    }[]>(null);

    const [selectedChain, setSelectedChain] = useState("");
    const [locations, setLocations] = useState<null | {
        name: string,
        url?: string
        location?: {
            coordinates?: {lat: number, long: number},
            address?: string,
            google_cid?: string,
            google_place_id?: string,
        },
        phone?: string
        business_hours?: string,
        extra: Record<string, any>,
        path: string[],
    }[]>(null);

    useEffect(() => {(async () => {
        const resp = await fetch(DATA_ROOT + "_metadata.json");
        const newMetadata = await resp.json()
        setMetadata(newMetadata);
    })()}, [])

    useEffect(() => {(async () => {
        if (metadata === null || selectedChain === "")
            return;

        const resp = await fetch(DATA_ROOT + selectedChain + ".json");
        const newLocations = (await resp.json()).locations;
        setLocations(newLocations);
    })()}, [metadata, selectedChain])

    return <div>
        <select className="select" onChange={(e) => setSelectedChain(e.target.value)}>{
            metadata === null ?
                <option value="" disabled selected>--- Loading... ---</option>
                :
                <><option value="" disabled selected>--- Select chain ---</option>
                {[...metadata]
                    .sort((c1,c2) => c2.num_locations - c1.num_locations)
                    .map(chain => <option value={chain.slug}>{chain.name} ({chain.num_locations} locations)</option>)}</>
        }</select>
        <br />
        <br />
        <MapContainer center={USA_CENTER} zoom={5} scrollWheelZoom={true} style={{width: "100%", aspectRatio: 2}} >
            <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {
                locations === null ? null : locations
                    .filter(location => location.location?.coordinates)
                    .map(location => <Marker position={[location.location!.coordinates!.lat, location.location!.coordinates!.long]}>
                        <Popup>
                            {location.path.filter(c => c.length).map(c => c + " > ")}
                            <b><u>{location.name}</u></b>
                            <br />
                            {location.location?.address === undefined ? null : <>{location.location.address}<br /></>}
                            {location.phone === undefined ? null : <>{location.phone}<br /></>}
                            {location.url === undefined ? null : <><a target="_blank" rel="noopener noreferrer" href={location.url}>link</a><br /></>}
                        </Popup>
                    </Marker>)
            }
        </MapContainer>
        </div>
}
