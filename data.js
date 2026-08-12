/* ═══════════════════════════════════════════════════════════════════
   CARBONATACIÓN & BRIX · Base de datos de especificaciones
   Fuente: LP-AC-E-01.11 Rev. 54 (14/04/2026) — Especificaciones de Línea
   lei = Límite inferior · obj = Objetivo · les = Límite superior
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const DB = [
{cat:"COCA-COLA",prod:"Coca-Cola",brix:{label:"° Brix",lei:10.22,obj:10.37,les:10.52},
 co2:[{pack:"PET (Todos)",lei:3.85,obj:4.10,les:4.35},{pack:"REF PET (2000)",lei:3.70,obj:3.95,les:4.20},{pack:"Vidrio (Todos)",lei:3.60,obj:3.85,les:4.10}],
 otros:[{n:"Concentración",lei:95.00,obj:100.00,les:105.00}]},
{cat:"COCA-COLA",prod:"Coca-Cola Sin Azúcar",brix:{label:"° Brix",lei:0.09,obj:0.24,les:0.39},
 co2:[{pack:"PET (Todos)",lei:3.70,obj:3.95,les:4.20},{pack:"REF PET (Todos)",lei:3.75,obj:4.00,les:4.25},{pack:"Vidrio (Todos)",lei:3.45,obj:3.70,les:3.95}],otros:[]},
{cat:"COCA-COLA",prod:"Coca-Cola Mid Cal (Einstein)",brix:{label:"° Brix",lei:7.24,obj:7.39,les:7.54},
 co2:[{pack:"PET (Todos)",lei:3.85,obj:4.10,les:4.35}],otros:[]},
{cat:"SPRITE",prod:"Sprite Full Sugar",brix:{label:"° Brix",lei:9.86,obj:10.01,les:10.16},
 co2:[{pack:"PET (Todos)",lei:3.90,obj:4.15,les:4.40},{pack:"REF PET (2000)",lei:3.75,obj:4.00,les:4.25},{pack:"Vidrio (Todos)",lei:3.65,obj:3.90,les:4.15}],otros:[]},
{cat:"FANTA",prod:"Fanta Naranja",brix:{label:"° Brix (Mid Cal)",lei:6.90,obj:7.05,les:7.20},
 co2:[{pack:"PET (Todos)",lei:2.60,obj:2.85,les:3.10},{pack:"REF PET (2000)",lei:2.45,obj:2.70,les:2.95},{pack:"Vidrio (Todos)",lei:2.35,obj:2.60,les:2.85}],otros:[]},
{cat:"FANTA",prod:"Fanta Naranja Mandarina",brix:{label:"° Brix (Reformulado)",lei:6.97,obj:7.12,les:7.27},
 co2:[{pack:"PET (Todos)",lei:2.10,obj:2.35,les:2.60},{pack:"REF PET (2000)",lei:1.95,obj:2.20,les:2.45},{pack:"Vidrio (Todos)",lei:1.85,obj:2.10,les:2.35}],otros:[]},
{cat:"FANTA",prod:"Fanta Zero",brix:{label:"° Brix (Reformulado)",lei:0.33,obj:0.48,les:0.63},
 co2:[{pack:"PET (Todos)",lei:2.75,obj:3.00,les:3.25}],
 otros:[{n:"Acidez",lei:95.00,obj:100.00,les:105.00},{n:"Acidez como Ac. Cítrico",lei:0.245,obj:0.258,les:0.271}]},
{cat:"FANTA",prod:"Fanta Papaya",brix:{label:"° Brix (Reformulado)",lei:6.76,obj:6.91,les:7.06},
 co2:[{pack:"PET (Todos)",lei:3.60,obj:3.85,les:4.10},{pack:"REF PET (2000)",lei:3.45,obj:3.70,les:3.95},{pack:"Vidrio (Todos)",lei:3.35,obj:3.60,les:3.85}],otros:[]},
{cat:"FANTA",prod:"Fanta Guaraná",brix:{label:"° Brix (Reformulado)",lei:6.83,obj:6.98,les:7.13},
 co2:[{pack:"PET (Todos)",lei:3.20,obj:3.45,les:3.70},{pack:"REF PET (2000)",lei:3.05,obj:3.30,les:3.55},{pack:"Vidrio (Todos)",lei:2.95,obj:3.20,les:3.45}],otros:[]},
{cat:"FANTA",prod:"Fanta Limón",brix:{label:"° Brix (Reformulado)",lei:6.85,obj:7.00,les:7.15},
 co2:[{pack:"PET (Todos)",lei:2.60,obj:2.85,les:3.10},{pack:"RPET (Todos)",lei:2.45,obj:2.70,les:2.95}],otros:[]},
{cat:"SIMBA",prod:"Simba Durazno",brix:{label:"° Brix (Reformulado)",lei:6.90,obj:7.05,les:7.20},
 co2:[{pack:"PET (Todos)",lei:2.85,obj:3.10,les:3.35},{pack:"Vidrio (Todos)",lei:2.60,obj:2.85,les:3.10}],otros:[]},
{cat:"SIMBA",prod:"Simba Manzana",brix:{label:"° Brix (Reformulado)",lei:6.89,obj:7.04,les:7.19},
 co2:[{pack:"PET (Todos)",lei:2.30,obj:2.55,les:2.80},{pack:"Vidrio (Todos)",lei:2.05,obj:2.30,les:2.55}],otros:[]},
{cat:"SIMBA",prod:"Simba Pomelo",brix:{label:"° Brix (Reformulado)",lei:7.13,obj:7.28,les:7.43},
 co2:[{pack:"PET (Todos)",lei:3.10,obj:3.35,les:3.60},{pack:"Vidrio (Todos)",lei:2.85,obj:3.10,les:3.35}],otros:[]},
{cat:"SIMBA",prod:"Simba Piña",brix:{label:"° Brix (Reformulado)",lei:6.95,obj:7.10,les:7.25},
 co2:[{pack:"PET (Todos)",lei:2.80,obj:3.05,les:3.30},{pack:"Vidrio (Todos)",lei:2.55,obj:2.80,les:3.05}],otros:[]},
{cat:"SCHWEPPES",prod:"Agua Tónica 990 ml",brix:{label:"° Brix",lei:8.85,obj:9.00,les:9.15},
 co2:[{pack:"PET (Todos)",lei:3.90,obj:4.15,les:4.40}],otros:[]},
{cat:"SCHWEPPES",prod:"Ginger Ale 990 ml",brix:{label:"° Brix",lei:4.36,obj:4.51,les:4.66},
 co2:[{pack:"PET (Todos)",lei:3.90,obj:4.15,les:4.40}],otros:[]},
{cat:"VITAL",prod:"Vital Sin Gas",brix:null,co2:[],
 otros:[{n:"Ozono Tanque",lei:0.30,obj:null,les:null},{n:"Ozono Botella",lei:0.10,obj:0.25,les:0.40},{n:"pH Bebida",lei:5.50,obj:7.50,les:8.50}]},
{cat:"VITAL",prod:"Vital Con Gas",brix:null,
 co2:[{pack:"PET",lei:3.90,obj:4.15,les:4.40}],
 otros:[{n:"pH",lei:6.50,obj:null,les:8.50},{n:"Turbidez NTU",lei:null,obj:null,les:0.30},{n:"TDS ppm",lei:15.00,obj:null,les:50.00}]},
{cat:"POWERADE",prod:"Powerade Multifruta",brix:{label:"° Brix",lei:6.22,obj:6.37,les:6.52},co2:[],
 otros:[{n:"Nitrógeno [psi]",lei:4.00,obj:6.00,les:8.00}]},
{cat:"POWERADE",prod:"Powerade Mora Azul",brix:{label:"° Brix",lei:6.28,obj:6.43,les:6.58},co2:[],
 otros:[{n:"Nitrógeno [psi]",lei:4.00,obj:6.00,les:8.00}]},
{cat:"POWERADE",prod:"Powerade Green Apple Sour",brix:{label:"° Brix",lei:4.17,obj:4.32,les:4.47},co2:[],
 otros:[{n:"Nitrógeno [psi]",lei:4.00,obj:6.00,les:8.00}]},
{cat:"POWERADE",prod:"Powerade Citrus Passionfruit",brix:{label:"° Brix",lei:4.09,obj:4.24,les:4.39},co2:[],
 otros:[{n:"Nitrógeno [psi]",lei:4.00,obj:6.00,les:8.00}]},
{cat:"POWERADE",prod:"Powerade Attack",brix:{label:"° Brix",lei:4.49,obj:4.64,les:4.79},co2:[],
 otros:[{n:"Nitrógeno [psi]",lei:4.00,obj:6.00,les:8.00}]},
{cat:"POWERADE",prod:"Powerade Counterattack",brix:{label:"° Brix",lei:4.43,obj:4.58,les:4.73},co2:[],
 otros:[{n:"Nitrógeno [psi]",lei:4.00,obj:6.00,les:8.00}]},
{cat:"AQUARIUS",prod:"Aquarius Manzana",brix:{label:"° Brix (Reformulado)",lei:7.52,obj:7.67,les:7.82},co2:[],
 otros:[{n:"Presión N₂ ≥ Litro [psi]",lei:6.00,obj:8.00,les:10.00},{n:"Presión N₂ < Litro [psi]",lei:4.00,obj:6.00,les:8.00}]},
{cat:"AQUARIUS",prod:"Aquarius Pera",brix:{label:"° Brix (Reformulado)",lei:7.57,obj:7.72,les:7.87},co2:[],
 otros:[{n:"Presión N₂ ≥ Litro [psi]",lei:6.00,obj:8.00,les:10.00},{n:"Presión N₂ < Litro [psi]",lei:4.00,obj:6.00,les:8.00}]},
{cat:"AQUARIUS",prod:"Aquarius Pomelo",brix:{label:"° Brix (Reformulado)",lei:7.83,obj:7.98,les:8.13},co2:[],
 otros:[{n:"Presión N₂ ≥ Litro [psi]",lei:6.00,obj:8.00,les:10.00},{n:"Presión N₂ < Litro [psi]",lei:4.00,obj:6.00,les:8.00}]},
{cat:"DEL VALLE",prod:"Del Valle Fresh Citrus",brix:{label:"° Brix",lei:4.98,obj:5.13,les:5.28},co2:[],
 otros:[{n:"Acidez como Ac. Cítrico",lei:0.305,obj:0.321,les:0.337},{n:"Presión N₂ ≥ Litro [psi]",lei:6.00,obj:8.00,les:10.00},{n:"Presión N₂ < Litro [psi]",lei:4.00,obj:6.00,les:8.00}]},
{cat:"DEL VALLE",prod:"Del Valle Manzana",brix:{label:"° Brix",lei:6.75,obj:6.90,les:7.05},co2:[],
 otros:[{n:"Acidez como Ac. Cítrico",lei:0.18,obj:0.19,les:0.19},{n:"Presión N₂ ≥ Litro [psi]",lei:6.00,obj:8.00,les:10.00},{n:"Presión N₂ < Litro [psi]",lei:4.00,obj:6.00,les:8.00}]},
{cat:"DEL VALLE",prod:"Del Valle Durazno",brix:{label:"° Brix",lei:4.75,obj:4.90,les:5.05},co2:[],
 otros:[{n:"Presión N₂ ≥ Litro [psi]",lei:6.00,obj:8.00,les:10.00},{n:"Presión N₂ < Litro [psi]",lei:4.00,obj:6.00,les:8.00}]},
{cat:"DEL VALLE",prod:"Del Valle Fresh Fruit Punch",brix:{label:"° Brix",lei:4.46,obj:4.61,les:4.76},co2:[],
 otros:[{n:"Acidez como Ac. Cítrico",lei:0.29,obj:0.31,les:0.32},{n:"Presión N₂ ≥ Litro [psi]",lei:6.00,obj:8.00,les:10.00},{n:"Presión N₂ < Litro [psi]",lei:4.00,obj:6.00,les:8.00}]},
{cat:"DEL VALLE",prod:"Del Valle Fresh Tropical Punch",brix:{label:"° Brix",lei:4.892,obj:5.042,les:5.192},co2:[],
 otros:[{n:"Acidez como Ac. Cítrico",lei:0.357,obj:0.376,les:0.395},{n:"Presión N₂ ≥ Litro [psi]",lei:6.00,obj:8.00,les:10.00},{n:"Presión N₂ < Litro [psi]",lei:4.00,obj:6.00,les:8.00}]}
];

/* Correcciones por defecto del equipo (planilla de referencia) */
const CORR_DEF = { p: '0,06', t: '0,08' };

/* Intervalo del análisis sensorial [horas] */
const SENSORIAL_INTERVALO = 4;
