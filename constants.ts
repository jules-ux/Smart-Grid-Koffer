import { Backpack } from './types';

// Demo data hersteld voor testen zonder actieve database.
export const MOCK_BACKPACKS: Backpack[] = [
  {
    id: 'DEMO-ESP32-01',
    qrCode: 'smartgrid:bp:DEMO-ESP32-01',
    name: 'Demo Koffer MUG',
    hospital: 'AZ Sint-Lucas Demo',
    type: 'Spoed',
    lastSync: new Date(Date.now() - 60000 * 2).toISOString(), // 2 minuten geleden
    batteryLevel: 88,
    grid_cols: 4,
    grid_rows: 4,
    operationalStatus: 'OPERATIONAL',
    modules: [
      // ROW 0
      {
        id: '01010001',
        name: 'Verbandset Basis',
        status: 'OK',
        lastUpdate: new Date().toISOString(),
        backpack_id: 'DEMO-ESP32-01',
        color: 'red',
        calculated_expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(), // 90 dagen
        pos_x: 0,
        pos_y: 0,
        width: 2,
        height: 1,
      },
      {
        id: '02010002', // This one will need replacement
        name: 'Ademhaling Set',
        status: 'OPENED',
        lastUpdate: new Date().toISOString(),
        backpack_id: 'DEMO-ESP32-01',
        color: 'blue',
        calculated_expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString(),
        pos_x: 2,
        pos_y: 0,
        width: 2,
        height: 1,
      },
      // ROW 1 & 2
      {
        id: '03010003',
        name: 'Medicatie Ampullen',
        status: 'OK',
        lastUpdate: new Date().toISOString(),
        backpack_id: 'DEMO-ESP32-01',
        color: 'yellow',
        calculated_expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 25).toISOString(), // 25 dagen (expiring soon)
        pos_x: 0,
        pos_y: 1,
        width: 2,
        height: 2,
      },
      {
        id: '01020004', // This one is missing
        name: 'Diagnostiek',
        status: 'MISSING',
        lastUpdate: new Date().toISOString(),
        backpack_id: 'DEMO-ESP32-01',
        color: 'red',
        calculated_expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
        pos_x: 2,
        pos_y: 1,
        width: 1,
        height: 1,
      },
       {
        id: '04010001',
        name: 'Hechtingsmateriaal',
        status: 'WRONG_POS', // This one is in the wrong spot
        lastUpdate: new Date().toISOString(),
        backpack_id: 'DEMO-ESP32-01',
        color: 'green',
        calculated_expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 300).toISOString(),
        pos_x: 3,
        pos_y: 1,
        width: 1,
        height: 1
      },
      {
        id: '02020005',
        name: 'Infuus & Spuiten',
        status: 'OK',
        lastUpdate: new Date().toISOString(),
        backpack_id: 'DEMO-ESP32-01',
        color: 'blue',
        calculated_expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 400).toISOString(),
        pos_x: 2,
        pos_y: 2,
        width: 2,
        height: 1,
      },
      // ROW 3
      {
        id: '04020006',
        name: 'Extra Materiaal',
        status: 'OK',
        lastUpdate: new Date().toISOString(),
        backpack_id: 'DEMO-ESP32-01',
        color: 'green',
        calculated_expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 500).toISOString(),
        pos_x: 0,
        pos_y: 3,
        width: 4,
        height: 1,
      }
    ]
  }
];