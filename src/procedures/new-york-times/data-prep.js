const _ = require('lodash');
const {ConceptTypes, ArticleCodeToName} = require('./types');
const ConceptCodeToType = _.invert(ConceptTypes);

function getConceptTypeFromCode(code) {
    const type = ConceptCodeToType[code];
    if (!type) {
        throw new Error(`Could not find concept type for ${code}`);
    }
    return type;
}

function getFacetsAsConcepts(info) {
    const conceptTypePairs = Object.keys(info)
        .filter(key => key.endsWith('_facet'))
        .map(key => [key, 'nytd_' + key.replace('_facet', '')])
        .filter(pair => ConceptCodeToType[pair[1]]);

    return conceptTypePairs.flatMap(pair => {
        const [key, conceptCode] = pair;
        const names = info[key] || [];
        const type = getConceptTypeFromCode(conceptCode);
        return names.map(name => ({name, type}));
    });
}

const ArticleFields = [
    'title',
    'abstract',
    'url',
    'byline',
    'kicker',
    'section',
    'subsection',
    'published_date',
    'multimedia'
];

const prepare = {
    Article: info => {
        const article = _.pick(info, ArticleFields);
        article.section = ArticleCodeToName[info.section] || info.section;
        article.concepts = getFacetsAsConcepts(info);
        return article;
    },
    SearchResult: info => ({
        title: info.headline.main,
        abstract: info.abstract,
        url: info.web_url,
        byline: info.byline.original,
        section: info.section_name,
        subsection: info.subsection_name,
        published_date: info.pub_date,
        type: info.type_of_material,
        multimedia: info.multimedia.map(md => ({
            type: md.type,
            subtype: md.subtype,
            caption: md.caption,
            copyright: md.copyright,
            url: md.url,
            height: md.height,
            width: md.width,
        })),
    }),
    MovieReview: review => ({
        headline: review.headline,
        title: review.display_title,
        byline: review.byline,
        summary_short: review.summary_short,
        opening_date: review.opening_date,
        publication_date: review.publication_date,
        mpaa_rating: review.mpaa_rating,
        critics_pick: review.critics_pick != 0,
        url: review.link.url,
    }),
    BestSeller: info => ({
        rank: info.rank,
        rank_last_week: info.rank_last_week,
        title: info.title,
        description: info.description,
        author: info.author,
        contributor: info.contributor,
        contributor_note: info.contributor_note,
        image_url: info.book_image,
        publisher: info.publisher,
    }),
    Book: info => ({
        title: info.title,
        description: info.description,
        author: info.author,
        contributor: info.contributor,
        contributor_note: info.contributor_note,
        publisher: info.publisher,
    }),
    Concept: info => ({
        name: info.concept_name,
        type: getConceptTypeFromCode(info.concept_type),
    }),
    ConceptArticle: info => ({
        title: info.title,
        byline: info.byline,
        body: info.body,
        date: info.date,
        url: info.url,
        concepts: Object.entries(info.concepts)
            .flatMap(entry => {
                const [code, names] = entry;
                const type = getConceptTypeFromCode(code);
                return names.map(name => ({name, type}));
            }),
    }),
    ConceptInfo: info => {
        const result = {
            name: info.concept_name,
            type: getConceptTypeFromCode(info.concept_type),
            links: (info.links || []).map(prepare.Link),
        };

        if (info.geocodes) {
            result.geocodes = info.geocodes.map(prepare.Geocode);
        }

        return result;
    },
    Link: info => _.pick(info, ['relation', 'link', 'link_type']),
    Geocode: info => ({
        name: info.name,
        latitude: info.latitude,
        longitude: info.longitude,
        elevation: info.elevation,
        population: info.population,
    }),
    PopularArticle: info => {
        const article = {
            title: info.title,
            abstract: info.abstract,
            byline: info.byline,
            section: ArticleCodeToName[info.section] || info.section,
            subsection: info.subsection,
            published_date: info.published_date,
            url: info.url,
            multimedia: info.media.flatMap(media => {
                const commonData = _.pick(media, ['type', 'subtype', 'caption', 'copyright']);
                return media['media-metadata'].map(md => _.extend(md, commonData));
            }),
        };
        article.concepts = getFacetsAsConcepts(info);
        return article;
    },
};


module.exports = prepare;
