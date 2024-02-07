const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');

// Estructura para almacenar las partidas
let partidas = [];

// Función para generar un ID aleatorio
function generarID() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Función para calcular la puntuación de una mano
function calcularPuntos(mano) {
    return mano.reduce((total, carta) => total + carta, 0);
}

// Función para determinar los ganadores de la partida
function determinarGanadores(partida) {
    const puntosCasa = calcularPuntos(partida.casa);
    partida.jugadores.forEach(jugador => {
        const puntosJugador = calcularPuntos(jugador.mano);
        if (puntosJugador > 21 || (puntosCasa <= 21 && puntosCasa > puntosJugador)) {
            // El jugador pierde
            jugador.monedas -= jugador.apuesta;
        } else if (puntosJugador === puntosCasa) {
            // Empate
            jugador.monedas += jugador.apuesta;
        } else {
            // El jugador gana
            jugador.monedas += jugador.apuesta * 2;
        }
    });
    partida.estado = "FINALIZADA";
}

// Función para verificar los turnos de los jugadores y la casa
function verificarTurnos(partida) {
    if (partida.jugadores.every(j => !j.enTurno)) {
        // Todos los jugadores han terminado, turno de la casa
        while (calcularPuntos(partida.casa) < 17) {
            partida.casa.push(Math.floor(Math.random() * 10) + 1);
        }
        determinarGanadores(partida);
    }
}

const esquema = buildSchema(`
    type Partida {
        id: ID!
        jugadores: [Jugador!]!
        casa: [Int!]!
        estado: EstadoPartida!
    }

    type Jugador {
        id: ID!
        mano: [Int!]!
        monedas: Int!
        apuesta: Int!
        enTurno: Boolean!
    }

    enum EstadoPartida {
        EN_CURSO
        FINALIZADA
    }

    type Query {
        obtenerPartidas: [Partida!]!
        obtenerPartida(id: ID!): Partida
    }

    type Mutation {
        crearPartida: Partida
        eliminarPartida(id: ID!): String
        anadirJugador(idPartida: ID!): Jugador
        realizarMovimiento(idPartida: ID!, idJugador: ID!, movimiento: Movimiento!): Partida
        realizarApuesta(idPartida: ID!, idJugador: ID!, apuesta: Int!): Jugador
        plantarse(idPartida: ID!, idJugador: ID!): Partida
    }

    enum Movimiento {
        PEDIR_CARTA
        PLANTARSE
    }
`);

const resolvers = {
    obtenerPartidas: () => partidas,
    obtenerPartida: ({ id }) => partidas.find(partida => partida.id === id),
    crearPartida: () => {
        const nuevaPartida = {
            id: generarID(),
            jugadores: [],
            casa: [],
            estado: "EN_CURSO"
        };
        partidas.push(nuevaPartida);
        return nuevaPartida;
    },
    eliminarPartida: ({ id }) => {
        const index = partidas.findIndex(partida => partida.id === id);
        if (index !== -1) {
            partidas.splice(index, 1);
            return 'Partida eliminada';
        }
        return 'Partida no encontrada';
    },
    anadirJugador: ({ idPartida }) => {
        const partida = partidas.find(partida => partida.id === idPartida);
        if (!partida) {
            throw new Error('Partida no encontrada');
        }
        const nuevoJugador = {
            id: generarID(),
            mano: [],
            monedas: 100,
            apuesta: 0,
            enTurno: true
        };
        partida.jugadores.push(nuevoJugador);
        return nuevoJugador;
    },
    realizarMovimiento: ({ idPartida, idJugador, movimiento }) => {
        const partida = partidas.find(partida => partida.id === idPartida);
        if (!partida) {
            throw new Error('Partida no encontrada');
        }

        const jugador = partida.jugadores.find(jugador => jugador.id === idJugador);
        if (!jugador) {
            throw new Error('Jugador no encontrado');
        }

        if (movimiento === 'PEDIR_CARTA') {
            const nuevaCarta = Math.floor(Math.random() * 10) + 1;
            jugador.mano.push(nuevaCarta);

            if (calcularPuntos(jugador.mano) > 21) {
                jugador.enTurno = false;
                verificarTurnos(partida);
            }
        } else if (movimiento === 'PLANTARSE') {
            jugador.enTurno = false;
            verificarTurnos(partida);
        } else {
            throw new Error('Movimiento no válido');
        }

        return partida;
    },
    realizarApuesta: ({ idPartida, idJugador, apuesta }) => {
        const partida = partidas.find(partida => partida.id === idPartida);
        if (!partida) {
            throw new Error('Partida no encontrada');
        }

        const jugador = partida.jugadores.find(jugador => jugador.id === idJugador);
        if (!jugador) {
            throw new Error('Jugador no encontrado');
        }

        if (apuesta <= 0 || apuesta > jugador.monedas) {
            throw new Error('Apuesta no válida');
        }

        jugador.apuesta = apuesta;
        jugador.monedas -= apuesta;

        return jugador;
    },
    plantarse: ({ idPartida, idJugador }) => {
        const partida = partidas.find(partida => partida.id === idPartida);
        if (!partida) {
            throw new Error('Partida no encontrada');
        }

        const jugador = partida.jugadores.find(jugador => jugador.id === idJugador);
        if (!jugador) {
            throw new Error('Jugador no encontrado');
        }

        jugador.enTurno = false;
        verificarTurnos(partida);

        return partida;
    }
};

const app = express();

app.use('/graphql', graphqlHTTP({
    schema: esquema,
    rootValue: resolvers,
    graphiql: true
}));

app.listen(3000, () => {
    console.log('Servidor GraphQL corriendo en http://localhost:3000/graphql');
});
