const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const User = require('../models/user');
const Movie = require('../models/movie');

const TMDB_KEY = process.env.TMDB_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

async function fetchTMDB(endpoint) {
  const url = `${TMDB_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}&api_key=${TMDB_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('TMDB API error');
  return await response.json();
}

router.get('/episodes/:id/:season', async (req, res) => {
  try {
    const { id, season } = req.params;
    const data = await fetchTMDB(`/tv/${id}/season/${season}`);

    const episodes = data.episodes.map(ep => ({
      episode_number: ep.episode_number,
      name: ep.name,
      overview: ep.overview
    }));

    res.json({ episodes });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching episodes' });
  }
});

// Check if an item is in the watchlist
router.get('/watchlist/check/:tmdbId', async (req, res) => {
    if (!req.session.user) {
        return res.json({ inWatchlist: false });
    }
    try {
        const { tmdbId } = req.params;
        const movie = await Movie.findOne({ tmdbId: tmdbId });
        if (!movie) {
            return res.json({ inWatchlist: false });
        }

        const user = await User.findById(req.session.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        
        const inWatchlist = user.watchlist.includes(movie._id);
        res.json({ inWatchlist });
    } catch (error) {
        console.error('Watchlist check error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.post('/watchlist/add', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'You must be logged in to add to your watchlist.' });
    }

    const { tmdbId, media_type } = req.body;

    try {
        const user = await User.findById(req.session.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        let movie = await Movie.findOne({ tmdbId });
        if (!movie) {
            const details = await fetchTMDB(`/${media_type}/${tmdbId}?append_to_response=credits`);
            movie = new Movie({
                tmdbId: details.id,
                media_type: media_type,
                title: details.title || details.name,
                overview: details.overview,
                poster_path: details.poster_path,
                release_date: details.release_date || details.first_air_date,
                vote_average: details.vote_average,
                genres: details.genres,
                credits: {
                    cast: details.credits.cast.slice(0, 20).map(person => ({
                        name: person.name,
                        character: person.character,
                        profile_path: person.profile_path
                    }))
                }
            });
            await movie.save();
        }

        // Check if the movie is already in the watchlist
        if (user.watchlist.some(item => item.equals(movie._id))) {
            return res.status(409).json({ message: 'Item already in watchlist.' });
        }

        user.watchlist.push(movie._id);
        await user.save();

        res.json({ success: true, message: 'Added to watchlist.' });
    } catch (error) {
        console.error('Error adding to watchlist:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Remove from watchlist
router.post('/watchlist/remove', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'You must be logged in to remove from your watchlist.' });
    }

    const { tmdbId } = req.body;

    try {
        const movie = await Movie.findOne({ tmdbId: tmdbId });
        if (!movie) {
            return res.status(404).json({ error: 'Item not found.' });
        }
        
        await User.findByIdAndUpdate(req.session.user.id, {
            $pull: { watchlist: movie._id }
        });
        
        res.json({ success: true, message: 'Removed from watchlist.' });
    } catch (error) {
        console.error('Error removing from watchlist:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
