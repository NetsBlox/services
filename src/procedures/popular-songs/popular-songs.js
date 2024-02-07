/**
 * This service contains of repository of popular piano songs.
 * @alpha
 * @service
 * @category Music
 */


const PopularSongs = {};
const path = require("path");
const popularSongsLibrary = require("./popularSongsLibrary.json");


/**
 * Get list of song names
 * @returns {Array}
 */
PopularSongs.getSongNames = async function(){
    var songNames = [];
    
    //Filter SongLibrary by songNames
    const queriedJSON = popularSongsLibrary.popularSongLibrary;
    //Put names inlist
    for (const [key,value] of Object.entries(queriedJSON)){
        songNames.push(value.songName);
    }
    return songNames;
};

/**
 * Get notes of song based on name
 * @param {String=} songName
 * @returns {Array}
 */
PopularSongs.getNoteNames = async function(songName = ""){
    var noteNames = [];
    let queriedJSON = "";

    //Ensure input is not empty
    if(songName !== ""){
        queriedJSON = popularSongsLibrary.popularSongLibrary.filter(function(obj){
            return(songName === "" || obj.songName === songName);
        })
    } else {
        throw Error("field cannot be empty")
    }

    for(const [key,value] of Object.entries(queriedJSON)){
      for(let i = 0; i < value.noteNames.length; i++){
        noteNames.push(value.noteNames[i]);
      }
    }
    return noteNames;
}

/**
 * Get note durations of song based on name
 * @param {String=} songName
 * @returns {Array}
 */
PopularSongs.getNoteDurations = async function(songName = ""){
    var noteDurations = [];
    let queriedJSON = "";

    //Ensure input is not empty
    if(songName !== ""){
        queriedJSON = popularSongsLibrary.popularSongLibrary.filter(function(obj){
            return(songName === "" || obj.songName === songName);
        })
    } else {
        throw Error("field cannot be empty")
    }

    for(const [key,value] of Object.entries(queriedJSON)){
      for(let i = 0; i < value.noteDurations.length; i++){
        noteDurations.push(value.noteDurations[i]);
      }
    }
    return noteDurations;
}

/**
 * Get note durations modifiers of song based on name
 * @param {String=} songName
 * @returns {Array}
 */
PopularSongs.getNoteDurationModifiers = async function(songName = ""){
    var noteDurationModifiers = [];
    let queriedJSON = "";

    //Ensure input is not empty
    if(songName !== ""){
        queriedJSON = popularSongsLibrary.popularSongLibrary.filter(function(obj){
            return(songName === "" || obj.songName === songName);
        })
    } else {
        throw Error("field cannot be empty")
    }

    for(const [key,value] of Object.entries(queriedJSON)){
      for(let i = 0; i < value.noteDurationMods.length; i++){
        noteDurationModifiers.push(value.noteDurationMods[i]);
      }
    }
    return noteDurationModifiers;
}

module.exports = PopularSongs;