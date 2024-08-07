const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  utils.verifyRPCInterfaces("MovieDB", [
    ["searchMovie", ["title"]],
    ["searchPerson", ["name"]],
    ["movieTitle", ["id"]],
    ["movieBackdropPath", ["id"]],
    ["movieBudget", ["id"]],
    ["movieGenres", ["id"]],
    ["movieOriginalLanguage", ["id"]],
    ["movieOriginalTitle", ["id"]],
    ["movieOverview", ["id"]],
    ["moviePopularity", ["id"]],
    ["moviePosterPath", ["id"]],
    ["movieProductionCompanies", ["id"]],
    ["movieProductionCountries", ["id"]],
    ["movieReleaseDate", ["id"]],
    ["movieRevenue", ["id"]],
    ["movieRuntime", ["id"]],
    ["movieSpokenLanguages", ["id"]],
    ["movieTagline", ["id"]],
    ["movieTitle", ["id"]],
    ["movieVoteAverage", ["id"]],
    ["movieVoteCount", ["id"]],
    ["personBiography", ["id"]],
    ["personBirthday", ["id"]],
    ["personDeathday", ["id"]],
    ["personGender", ["id"]],
    ["personName", ["id"]],
    ["personPlaceOfBirth", ["id"]],
    ["personPopularity", ["id"]],
    ["personProfilePath", ["id"]],
    ["movieCastCharacters", ["id"]],
    ["movieCastNames", ["id"]],
    ["movieCastPersonIDs", ["id"]],
    ["movieCastProfilePaths", ["id"]],
    ["movieCrewNames", ["id"]],
    ["movieCrewJobs", ["id"]],
    ["movieCrewPersonIDs", ["id"]],
    ["movieCrewProfilePaths", ["id"]],
    ["personImageFilePaths", ["id"]],
    ["personImageAspectRatios", ["id"]],
    ["personImageHeights", ["id"]],
    ["personImageWidths", ["id"]],
    ["personImageVoteCounts", ["id"]],
    ["personCastCharacters", ["id"]],
    ["personCastMovieIDs", ["id"]],
    ["personCastOriginalTitles", ["id"]],
    ["personCastPosterPaths", ["id"]],
    ["personCastReleaseDates", ["id"]],
    ["personCastTitles", ["id"]],
    ["personCrewMovieIDs", ["id"]],
    ["personCrewJobs", ["id"]],
    ["personCrewOriginalTitles", ["id"]],
    ["personCrewPosterPaths", ["id"]],
    ["personCrewReleaseDates", ["id"]],
    ["personCrewTitles", ["id"]],
    ["getImage", ["path"]],
  ]);
});
