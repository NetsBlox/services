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

const baseUrl = "https://www.thesportsdb.com/api/v1/json";

const TheSportsDb = new ApiConsumer("TheSportsDb", baseUrl, {
  cache: { ttl: 60 },
});

TheSportsDb._searchTeams = async function (teamName, apiKey) {
  const queryString = rpcUtils.encodeQueryData({ t: teamName });
  const data = await this._requestData({
    path: `${apiKey}/searchteams.php`,
    queryString,
  });

  return data && data.teams ? data.teams : [];
};

TheSportsDb._getTeam = async function (teamName, apiKey, sport) {
  const teams = await this._searchTeams(teamName, apiKey);
  if (!sport) {
    return teams.length ? teams[0] : null;
  }

  const normalizedSport = sport.trim().toLowerCase();
  return teams.find((team) =>
    (team.strSport || "").trim().toLowerCase() === normalizedSport
  );
};

/**
 * Get the most recent completed game stats of a team.
 *
 * @param {String} teamName Team name to search for
 * @param {String=} sport Sport name to filter matches (optional)
 * @param {String} apiKey TheSportsDB API key
 * @returns {Object} structured data with the most recent game stats
 */
TheSportsDb.recentTeamStats = async function (teamName, sport, apiKey) {
  const team = await this._getTeam(teamName, apiKey, sport);
  if (!team) {
    return null;
  }

  const queryString = rpcUtils.encodeQueryData({ id: team.idTeam });
  const data = await this._requestData({
    path: `${apiKey}/eventslast.php`,
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
 * @param {String} apiKey TheSportsDB API key
 * @returns {Object} structured data with the matched team info
 */
TheSportsDb.getTeamInfo = async function (teamName, sport, apiKey) {
  const team = await this._getTeam(teamName, apiKey, sport);
  if (!team) {
    return null;
  }

  return {
    name: team.strTeam,
    sport: team.strSport,
    league: team.strLeague,
    country: team.strCountry,
    formedYear: team.intFormedYear,
  };
};

// As a general comment, I want to add the location of a match to recentTeamStats in the future.
// However, from my tests, the above seems unreliable, as it always uses the team's home stadium.
// Want to implement charting of an individual team's stats over multiple seasons.

module.exports = TheSportsDb;
