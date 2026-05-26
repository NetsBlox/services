/**
 * TheSportsDB Service provides access to sports stats using TheSportsDB API.
 * For more information, check out https://www.thesportsdb.com/documentation.
 *
 * @service
 * @category Society
 * @category Media
 */
"use strict";

const ApiConsumer = require("../utils/api-consumer");
const rpcUtils = require("../utils");
const logger = require("../utils/logger")("TheSportsDB");

const { TheSportsDbKey, InvalidKeyError } = require("../utils/api-key");

const baseUrl = "https://www.thesportsdb.com/api/v1/json";

const TheSportsDb = new ApiConsumer("TheSportsDb", baseUrl, {
  cache: { ttl: 60 },
});

ApiConsumer.trySetGlobalApiKey(TheSportsDb, TheSportsDbKey);

TheSportsDb._searchTeams = async function (teamName) {
  const queryString = rpcUtils.encodeQueryData({ t: teamName });
  const data = await this._requestData({
    path: `${this.apiKey.value}/searchteams.php`,
    queryString,
  });

  return data && data.teams ? data.teams : [];
};

TheSportsDb._getTeam = async function (teamName, sport) {
  const teams = await this._searchTeams(teamName);
  if (!sport) {
    return teams.length ? teams[0] : null;
  }

  const normalizedSport = sport.trim().toLowerCase();
  const team = teams.find(
    (team) => (team.strSport || "").trim().toLowerCase() === normalizedSport,
  );
  if (team === undefined) {
    throw new Error("Team not found");
  } else {
    return team;
  }
};

/**
 * Get the most recent completed game stats of a team.
 *
 * @param {String} teamName Team name to search for
 * @param {String=} sport Sport name to filter matches (optional)
 * @returns {Object} structured data with the most recent game stats
 */
TheSportsDb.recentTeamStats = async function (teamName, sport) {
  const team = await this._getTeam(teamName, sport);
  if (!team) {
    throw new Error("Team Not found");
  }

  const queryString = rpcUtils.encodeQueryData({ id: team.idTeam });
  const data = await this._requestData({
    path: `${this.apiKey.value}/eventslast.php`,
    queryString,
  });

  const events = data && data.results ? data.results : [];
  const normalizedTeamName = (team.strTeam || "").trim().toLowerCase();
  let latest = null;
  let latestStats = null;

  // Some entries could be upcoming/unscored. Scan until find a completed game.
  for (const event of events) {
    const homeTeam = (event.strHomeTeam || "").trim().toLowerCase();
    const awayTeam = (event.strAwayTeam || "").trim().toLowerCase();
    const homeScore = parseInt(event.intHomeScore, 10);
    const awayScore = parseInt(event.intAwayScore, 10);

    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
      continue;
    }

    const isHome = normalizedTeamName === homeTeam;
    const isAway = normalizedTeamName === awayTeam;
    if (!isHome && !isAway) {
      continue;
    }

    latest = event;
    latestStats = {
      opponent: isHome ? event.strAwayTeam : event.strHomeTeam,
      pointsFor: isHome ? homeScore : awayScore,
      pointsAgainst: isHome ? awayScore : homeScore,
    };
    break;
  }

  if (!latest || !latestStats) {
    return null;
  }

  return {
    opponent: latestStats.opponent,
    pointsFor: latestStats.pointsFor,
    pointsAgainst: latestStats.pointsAgainst,
    date: latest.dateEvent,
    event: latest.strEvent,
  };
};

/**
 * Get basic info of a team.
 *
 * @param {String} teamName Team name to search for
 * @param {String=} sport Sport name to filter matches (optional)
 * @returns {Object} structured data with the matched team info
 */
TheSportsDb.getTeamInfo = async function (teamName, sport) {
  const team = await this._getTeam(teamName, sport);
  if (!team) {
    throw new Error("Team Not found");
  }

  return {
    name: team.strTeam,
    sport: team.strSport,
    league: team.strLeague,
    country: team.strCountry,
    formedYear: team.intFormedYear,
  };
};

// This above is a stats implementation with V1!
// Getting the V2 API would allow for RPCs with live score data by sport and league.
// It would also allow for searching within the next/previous 10 events of a team/league/venue.
// Also would allow a full team/league schedule search.

// TODO:
// V2 features listed above would allow this to become a complete sports stats service.
// If we go ahead with V2, then implementing premium feature error handling will be needed.
// (e.g., "This feature requires a premium TheSportsDB key.")
// Also want to implement charting of an individual team's points over multiple seasons.

module.exports = TheSportsDb;
