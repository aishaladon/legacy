// African American Historical and Cultural Institutions seed data
// Source: Association for African American Museums (AAAM) directory and affiliated institutions
const africanAmericanMuseums = [

  // ── Alabama ──────────────────────────────────────────────────────────
  { name: 'Birmingham Civil Rights Institute', institution_type: 'Museum', relationship_status: 'Target', city: 'Birmingham', state: 'AL', website: 'https://www.bcri.org', notes: 'Documents the Civil Rights Movement in Birmingham; archive and digitization opportunities.' },
  { name: 'Alabama Department of Archives and History', institution_type: 'Archive', relationship_status: 'Target', city: 'Montgomery', state: 'AL', website: 'https://www.archives.state.al.us', notes: 'State archives with significant African American history collections.' },
  { name: 'National Memorial for Peace and Justice', institution_type: 'Memorial/Museum', relationship_status: 'Target', city: 'Montgomery', state: 'AL', website: 'https://museumandmemorial.eji.org', notes: 'Equal Justice Initiative memorial; preservation and documentation work.' },
  { name: 'Legacy Museum (Equal Justice Initiative)', institution_type: 'Museum', relationship_status: 'Target', city: 'Montgomery', state: 'AL', website: 'https://museumandmemorial.eji.org/museum', notes: 'EJI museum on the history of racial slavery, lynching, and mass incarceration.' },
  { name: 'Dexter Avenue King Memorial Baptist Church', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Montgomery', state: 'AL', website: 'https://www.dexterkingmemorial.org', notes: 'MLK Jr.\'s first pastorate; civil rights history site with preservation needs.' },
  { name: 'Tuskegee Airmen National Historic Site', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Tuskegee', state: 'AL', website: 'https://www.nps.gov/tuai', notes: 'NPS site commemorating Tuskegee Airmen; collections and interpretive work.' },
  { name: 'George Washington Carver Museum (Tuskegee University)', institution_type: 'Museum', relationship_status: 'Target', city: 'Tuskegee', state: 'AL', website: 'https://www.nps.gov/tuin', notes: 'NPS site at Tuskegee University; collections and archives.' },

  // ── Arkansas ─────────────────────────────────────────────────────────
  { name: 'Mosaic Templars Cultural Center', institution_type: 'Museum', relationship_status: 'Target', city: 'Little Rock', state: 'AR', website: 'https://www.mosaictemplarscenter.com', notes: 'Arkansas state agency museum focused on African American history and culture.' },
  { name: 'Little Rock Central High School National Historic Site', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Little Rock', state: 'AR', website: 'https://www.nps.gov/chsc', notes: 'NPS site commemorating 1957 desegregation crisis; interpretive and preservation work.' },
  { name: 'Elaine Legacy Center', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Elaine', state: 'AR', website: '', notes: 'Commemorates the 1919 Elaine Massacre; community preservation and documentation.' },

  // ── California ───────────────────────────────────────────────────────
  { name: 'California African American Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Los Angeles', state: 'CA', website: 'https://caamuseum.org', notes: 'State-funded museum focused on African American art, history, and culture.' },
  { name: 'African American Museum and Library at Oakland', institution_type: 'Museum', relationship_status: 'Target', city: 'Oakland', state: 'CA', website: 'https://www.oaklandlibrary.org/locations/african-american-museum-library-oakland', notes: 'Preserves and interprets the history and culture of African Americans in California.' },
  { name: 'Museum of the African Diaspora (MoAD)', institution_type: 'Museum', relationship_status: 'Target', city: 'San Francisco', state: 'CA', website: 'https://www.moadsf.org', notes: 'Explores the origins, history, and culture of the African diaspora.' },
  { name: 'Leimert Park Village', institution_type: 'Cultural District', relationship_status: 'Target', city: 'Los Angeles', state: 'CA', website: '', notes: 'Cultural hub of African American arts and culture in LA; community preservation initiatives.' },
  { name: 'Watts Towers Arts Center', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Los Angeles', state: 'CA', website: 'https://www.wattstowers.org', notes: 'City-operated arts center adjacent to iconic Watts Towers; preservation and programming.' },
  { name: 'African American History and Culture Museum (San Diego)', institution_type: 'Museum', relationship_status: 'Target', city: 'San Diego', state: 'CA', website: 'https://www.aahcm.org', notes: 'San Diego\'s repository for African American history; collections and programming.' },

  // ── Colorado ─────────────────────────────────────────────────────────
  { name: 'Black American West Museum and Heritage Center', institution_type: 'Museum', relationship_status: 'Target', city: 'Denver', state: 'CO', website: 'https://www.bawmhc.org', notes: 'Documents African American contributions to settling the American West.' },

  // ── Connecticut ──────────────────────────────────────────────────────
  { name: 'Amistad Center for Art and Culture', institution_type: 'Museum', relationship_status: 'Target', city: 'Hartford', state: 'CT', website: 'https://www.amistadartandculture.org', notes: 'Major collection of African American art; housed at Wadsworth Atheneum.' },
  { name: 'Harriet Beecher Stowe Center', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Hartford', state: 'CT', website: 'https://www.harrietbeecherstowecenter.org', notes: 'Historic home; social justice programming and preservation needs.' },

  // ── Delaware ─────────────────────────────────────────────────────────
  { name: 'Delaware Black Box Theatre', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Wilmington', state: 'DE', website: '', notes: 'African American performing arts center in Wilmington.' },

  // ── District of Columbia ─────────────────────────────────────────────
  { name: 'Anacostia Community Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Washington', state: 'DC', website: 'https://anacostia.si.edu', notes: 'Smithsonian museum focused on African American urban history; already in starter list but key target.' },
  { name: 'Frederick Douglass National Historic Site', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Washington', state: 'DC', website: 'https://www.nps.gov/frdo', notes: 'NPS site; Cedar Hill, Douglass\'s DC home; preservation and interpretive work.' },
  { name: 'Mary McLeod Bethune Council House', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Washington', state: 'DC', website: 'https://www.nps.gov/mamc', notes: 'NPS site; headquarters of National Council of Negro Women; collections and archives.' },
  { name: 'African American Civil War Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Washington', state: 'DC', website: 'https://www.afroamcivilwar.org', notes: 'Documents USCT soldiers; collections, digitization, and preservation work.' },
  { name: 'Howard University Gallery of Art', institution_type: 'Museum', relationship_status: 'Target', city: 'Washington', state: 'DC', website: 'https://www.howard.edu/library/gallery', notes: 'HBCU gallery with significant African American art collection.' },
  { name: 'Howard University Moorland-Spingarn Research Center', institution_type: 'Archive', relationship_status: 'Target', city: 'Washington', state: 'DC', website: 'https://www.howard.edu/moorlandspingarn', notes: 'One of the world\'s largest collections on African American history and culture.' },

  // ── Florida ──────────────────────────────────────────────────────────
  { name: 'History Miami Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Miami', state: 'FL', website: 'https://www.historymiami.org', notes: 'Significant African American history collections in greater Miami area.' },
  { name: 'Ritz Theatre and Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Jacksonville', state: 'FL', website: 'https://www.ritzjacksonville.com', notes: 'African American community museum in LaVilla historic district; preservation and collections.' },
  { name: 'Carver Museum (Austin, TX) — see Texas', institution_type: 'Museum', relationship_status: 'Target', city: 'Jacksonville', state: 'FL', website: '', notes: '' },
  { name: 'Zora Neale Hurston National Museum of Fine Arts', institution_type: 'Museum', relationship_status: 'Target', city: 'Eatonville', state: 'FL', website: 'https://www.zoranealehurstonmuseum.com', notes: 'Located in historic all-Black town; art and cultural programming.' },
  { name: 'Mary Bethune Foundation (Bethune-Cookman University)', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Daytona Beach', state: 'FL', website: 'https://www.bethune.cookman.edu', notes: 'HBCU with historic preservation site; National Historic Landmark.' },
  { name: 'Black Archives Research Center and Museum (FAMU)', institution_type: 'Archive', relationship_status: 'Target', city: 'Tallahassee', state: 'FL', website: 'https://www.famu.edu', notes: 'African American archives at Florida A&M University (HBCU).' },
  { name: 'Museum of Arts and Sciences (Daytona Beach) — African American Wing', institution_type: 'Museum', relationship_status: 'Target', city: 'Daytona Beach', state: 'FL', website: 'https://www.moas.org', notes: 'Hosts African American art and history exhibitions.' },

  // ── Georgia ──────────────────────────────────────────────────────────
  { name: 'National Center for Civil and Human Rights', institution_type: 'Museum', relationship_status: 'Target', city: 'Atlanta', state: 'GA', website: 'https://www.civilandhumanrights.org', notes: 'Major civil rights museum in Atlanta; preservation and programming opportunities.' },
  { name: 'Martin Luther King Jr. National Historic Site', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Atlanta', state: 'GA', website: 'https://www.nps.gov/malu', notes: 'NPS site; MLK\'s birthplace and Ebenezer Baptist Church; collections and preservation.' },
  { name: 'Apex Museum (African American Panoramic Experience)', institution_type: 'Museum', relationship_status: 'Target', city: 'Atlanta', state: 'GA', website: 'https://www.apexmuseum.org', notes: 'Dedicated to preserving and sharing African American history in Atlanta.' },
  { name: 'Auburn Avenue Research Library on African American Culture', institution_type: 'Archive', relationship_status: 'Target', city: 'Atlanta', state: 'GA', website: 'https://www.afpls.org/auburn-avenue-research-library', notes: 'Fulton County Library branch; major African American research collection.' },
  { name: 'Herndon Home', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Atlanta', state: 'GA', website: 'https://www.herndonhome.org', notes: 'Home of Alonzo Herndon, founder of Atlanta Life Insurance Company; preservation needs.' },
  { name: 'Museum of African American History (Savannah)', institution_type: 'Museum', relationship_status: 'Target', city: 'Savannah', state: 'GA', website: '', notes: 'Documents African American history in coastal Georgia.' },
  { name: 'Tubman Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Macon', state: 'GA', website: 'https://www.tubmanmuseum.com', notes: 'Focuses on African American art, history, and culture in Georgia.' },
  { name: 'Beach Institute African American Cultural Center', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Savannah', state: 'GA', website: 'https://www.kingtisdell.org', notes: 'One of the oldest African American school buildings in the South; collections and preservation.' },

  // ── Illinois ─────────────────────────────────────────────────────────
  { name: 'DuSable Black History Museum and Education Center', institution_type: 'Museum', relationship_status: 'Target', city: 'Chicago', state: 'IL', website: 'https://www.dusablemuseum.org', notes: 'Chicago\'s premier African American history institution; collections preservation.' },
  { name: 'Bronzeville Children\'s Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Chicago', state: 'IL', website: 'https://www.bronzevillechildrensmuseum.com', notes: 'First Black-owned children\'s museum in the US.' },
  { name: 'National Blues Museum (Chicago connection)', institution_type: 'Museum', relationship_status: 'Target', city: 'Chicago', state: 'IL', website: '', notes: 'Chicago Blues heritage sites; preservation and documentation work.' },
  { name: 'Chicago History Museum — African American Collections', institution_type: 'Museum', relationship_status: 'Target', city: 'Chicago', state: 'IL', website: 'https://www.chicagohistory.org', notes: 'Significant African American Chicago history collections.' },

  // ── Indiana ──────────────────────────────────────────────────────────
  { name: 'Indiana African American Heritage Center', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Indianapolis', state: 'IN', website: '', notes: 'Documents African American history in Indiana.' },
  { name: 'Madame Walker Legacy Center', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Indianapolis', state: 'IN', website: 'https://www.walkertheatre.com', notes: 'Historic venue built by Madam C.J. Walker; preservation and cultural programming.' },
  { name: 'Freetown Village Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Indianapolis', state: 'IN', website: 'https://www.freetown.org', notes: 'Living history museum focused on 1870s African American life in Indiana.' },
  { name: 'Crispus Attucks Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Indianapolis', state: 'IN', website: 'https://www.crispusattucksmuseum.com', notes: 'Documents African American contributions to Indiana history.' },

  // ── Kansas ───────────────────────────────────────────────────────────
  { name: 'Brown v. Board of Education National Historic Site', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Topeka', state: 'KS', website: 'https://www.nps.gov/brvb', notes: 'NPS site at Monroe Elementary School; landmark desegregation case.' },
  { name: 'Nicodemus National Historic Site', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Nicodemus', state: 'KS', website: 'https://www.nps.gov/nico', notes: 'Only remaining western town established by Black Exodusters after Reconstruction.' },

  // ── Kentucky ─────────────────────────────────────────────────────────
  { name: 'Kentucky African American Heritage Commission', institution_type: 'Cultural Organization', relationship_status: 'Target', city: 'Frankfort', state: 'KY', website: 'https://www.kyaahc.com', notes: 'State commission; documentation and preservation of African American heritage.' },
  { name: 'Louisville Urban League — Black History Gallery', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Louisville', state: 'KY', website: 'https://www.lul.org', notes: 'Gallery and collections focused on Louisville\'s Black history.' },
  { name: 'Muhammad Ali Center', institution_type: 'Museum', relationship_status: 'Target', city: 'Louisville', state: 'KY', website: 'https://www.alicenter.org', notes: 'Nonprofit museum dedicated to Muhammad Ali\'s legacy and humanitarian principles.' },

  // ── Louisiana ────────────────────────────────────────────────────────
  { name: 'New Orleans African American Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'New Orleans', state: 'LA', website: 'https://www.noaam.org', notes: 'Housed in historic Tremé neighborhood; preservation of African American Creole heritage.' },
  { name: 'Whitney Plantation Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Wallace', state: 'LA', website: 'https://www.whitneyplantation.com', notes: 'Only plantation museum in Louisiana focused exclusively on enslaved peoples\' experiences.' },
  { name: 'River Road African American Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Donaldsonville', state: 'LA', website: 'https://www.africanamericanmuseum.org', notes: 'Documents African American life along the Mississippi River Road plantation corridor.' },
  { name: 'Amistad Research Center (Tulane University)', institution_type: 'Archive', relationship_status: 'Target', city: 'New Orleans', state: 'LA', website: 'https://www.amistadresearchcenter.org', notes: 'Nation\'s largest archive of primary source materials for African American history.' },
  { name: 'Southern University Museum of Art', institution_type: 'Museum', relationship_status: 'Target', city: 'Baton Rouge', state: 'LA', website: 'https://www.sus.edu', notes: 'HBCU museum with African American art collection.' },
  { name: 'Dillard University — African American Art Collection', institution_type: 'Museum', relationship_status: 'Target', city: 'New Orleans', state: 'LA', website: 'https://www.dillard.edu', notes: 'HBCU with historic art collection; preservation needs.' },

  // ── Maryland ─────────────────────────────────────────────────────────
  { name: 'Reginald F. Lewis Museum of Maryland African American History & Culture', institution_type: 'Museum', relationship_status: 'Target', city: 'Baltimore', state: 'MD', website: 'https://www.rflewismuseum.org', notes: 'Maryland\'s official African American history museum; collections and programming.' },
  { name: 'Banneker-Douglass Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Annapolis', state: 'MD', website: 'https://www.bdmuseum.maryland.gov', notes: 'Maryland State Archives affiliate; documents African American history in Maryland.' },
  { name: 'National Great Blacks in Wax Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Baltimore', state: 'MD', website: 'https://www.ngbiwmuseum.org', notes: 'First wax museum in the US dedicated to African American history.' },
  { name: 'Morgan State University James E. Lewis Museum of Art', institution_type: 'Museum', relationship_status: 'Target', city: 'Baltimore', state: 'MD', website: 'https://www.morgan.edu/jelmoa', notes: 'HBCU museum with significant African American art collection.' },
  { name: 'Harriet Tubman Underground Railroad National Historical Park', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Church Creek', state: 'MD', website: 'https://www.nps.gov/hatu', notes: 'NPS park in Tubman\'s birthplace region; interpretive and preservation work.' },

  // ── Massachusetts ────────────────────────────────────────────────────
  { name: 'Museum of African American History (Boston)', institution_type: 'Museum', relationship_status: 'Target', city: 'Boston', state: 'MA', website: 'https://www.maah.org', notes: 'Operates African Meeting House and Abiel Smith School on Black Heritage Trail.' },
  { name: 'African Meeting House', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Boston', state: 'MA', website: 'https://www.maah.org/africanmeetinghouse', notes: 'Oldest Black church building still standing in the US; preservation priority.' },
  { name: 'Smithsonian Institution Traveling Exhibition Service (regional)', institution_type: 'Cultural Organization', relationship_status: 'Target', city: 'Boston', state: 'MA', website: '', notes: 'SITES traveling exhibitions of African American cultural content.' },

  // ── Michigan ─────────────────────────────────────────────────────────
  { name: 'Charles H. Wright Museum of African American History', institution_type: 'Museum', relationship_status: 'Target', city: 'Detroit', state: 'MI', website: 'https://www.thewright.org', notes: 'World\'s largest museum dedicated to African American history and culture.' },
  { name: 'Michigan State University Museum — African American Collections', institution_type: 'Museum', relationship_status: 'Target', city: 'East Lansing', state: 'MI', website: 'https://museum.msu.edu', notes: 'University museum with significant cultural collections.' },
  { name: 'Your Heritage House (Detroit)', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Detroit', state: 'MI', website: 'https://www.yourheritage.org', notes: 'African American cultural center in Detroit; community programming and preservation.' },

  // ── Mississippi ──────────────────────────────────────────────────────
  { name: 'Mississippi Civil Rights Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Jackson', state: 'MS', website: 'https://www.mdah.ms.gov/mcrm', notes: 'State-funded museum documenting civil rights struggle in Mississippi.' },
  { name: 'Museum of Mississippi History', institution_type: 'Museum', relationship_status: 'Target', city: 'Jackson', state: 'MS', website: 'https://www.mdah.ms.gov/mmh', notes: 'State museum with major African American history collections.' },
  { name: 'Delta Blues Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Clarksdale', state: 'MS', website: 'https://www.deltabluesmuseum.org', notes: 'Preserves the heritage of the Blues — African American musical tradition.' },
  { name: 'Emmett Till Interpretive Center', institution_type: 'Museum', relationship_status: 'Target', city: 'Sumner', state: 'MS', website: 'https://www.emmett-till.org', notes: 'Documents the murder of Emmett Till and its impact on the Civil Rights Movement.' },
  { name: 'Medgar and Myrlie Evers Home National Monument', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Jackson', state: 'MS', website: 'https://www.nps.gov/mame', notes: 'NPS site; home of NAACP field secretary Medgar Evers.' },
  { name: 'Alcorn State University Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Lorman', state: 'MS', website: 'https://www.alcorn.edu', notes: 'HBCU with African American history collections.' },

  // ── Missouri ─────────────────────────────────────────────────────────
  { name: 'National Blues Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'St. Louis', state: 'MO', website: 'https://www.nationalbluesmuseum.org', notes: 'Preserves and interprets the history of Blues music — a foundational African American art form.' },
  { name: 'Scott Joplin House State Historic Site', institution_type: 'Historic Site', relationship_status: 'Target', city: 'St. Louis', state: 'MO', website: 'https://mostateparks.com/park/scott-joplin-house-state-historic-site', notes: 'Home of ragtime composer Scott Joplin; preservation and collections.' },
  { name: 'Missouri History Museum — African American Collections', institution_type: 'Museum', relationship_status: 'Target', city: 'St. Louis', state: 'MO', website: 'https://www.mohistory.org', notes: 'Major collections on African American history in Missouri and the Gateway City.' },
  { name: 'Dred Scott Heritage Foundation', institution_type: 'Cultural Organization', relationship_status: 'Target', city: 'St. Louis', state: 'MO', website: 'https://www.thedredscottfoundation.org', notes: 'Educates about the Dred Scott decision and its continuing legacy.' },

  // ── Nebraska ─────────────────────────────────────────────────────────
  { name: 'Great Plains Black History Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Omaha', state: 'NE', website: 'https://www.gpblackhistorymuseum.org', notes: 'Documents African American history in the Great Plains region.' },

  // ── New Jersey ───────────────────────────────────────────────────────
  { name: 'Afro-American Historical Society Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Jersey City', state: 'NJ', website: '', notes: 'Documents African American history in New Jersey.' },
  { name: 'Paul Robeson House and Museum', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Princeton', state: 'NJ', website: 'https://www.paulrobesonhouseprinceton.org', notes: 'Birthplace of Paul Robeson; preservation and interpretation of his legacy.' },

  // ── New York ─────────────────────────────────────────────────────────
  { name: 'Schomburg Center for Research in Black Culture', institution_type: 'Archive', relationship_status: 'Target', city: 'New York', state: 'NY', website: 'https://www.nypl.org/locations/schomburg', notes: 'World\'s preeminent research library for African American and African diaspora culture.' },
  { name: 'Studio Museum in Harlem', institution_type: 'Museum', relationship_status: 'Target', city: 'New York', state: 'NY', website: 'https://www.studiomuseum.org', notes: 'Premier institution devoted to artists of the African diaspora; collections and programming.' },
  { name: 'Weeksville Heritage Center', institution_type: 'Museum', relationship_status: 'Target', city: 'Brooklyn', state: 'NY', website: 'https://www.weeksvillesociety.org', notes: 'Preserves historic free Black community in Brooklyn; collections and preservation.' },
  { name: 'Harriet Tubman National Historical Park (Auburn, NY)', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Auburn', state: 'NY', website: 'https://www.nps.gov/hart', notes: 'NPS park; Tubman\'s later home and African Methodist Episcopal Zion Church.' },
  { name: 'African American Museum of Nassau County', institution_type: 'Museum', relationship_status: 'Target', city: 'Hempstead', state: 'NY', website: 'https://www.aamofnassaucounty.org', notes: 'Documents African American history and culture on Long Island.' },
  { name: 'Niagara Falls Underground Railroad Heritage Center', institution_type: 'Museum', relationship_status: 'Target', city: 'Niagara Falls', state: 'NY', website: 'https://www.niagarafallsundergroundrailroad.org', notes: 'Documents the Underground Railroad and freedom seekers at the US–Canada border.' },
  { name: 'Onondaga Historical Association — African American Collections', institution_type: 'Archive', relationship_status: 'Target', city: 'Syracuse', state: 'NY', website: 'https://www.cnyhistory.org', notes: 'Regional history collections with significant African American heritage materials.' },
  { name: 'Lewis Latimer House Museum', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Flushing', state: 'NY', website: 'https://www.lewislatimerhousemuseum.org', notes: 'Home of Black inventor Lewis Latimer; preservation and educational programming.' },

  // ── North Carolina ───────────────────────────────────────────────────
  { name: 'Harvey B. Gantt Center for African American Arts and Culture', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Charlotte', state: 'NC', website: 'https://www.ganttcenter.org', notes: 'Major African American arts and cultural center in Charlotte.' },
  { name: 'International Civil Rights Center and Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Greensboro', state: 'NC', website: 'https://www.sitinmovement.org', notes: 'Site of the 1960 Greensboro sit-ins at Woolworth\'s lunch counter.' },
  { name: 'Charlotte Hawkins Brown Museum', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Sedalia', state: 'NC', website: 'https://www.ncdcr.gov/about/history/division-historical-resources/nc-historic-sites/charlotte-hawkins-brown-museum', notes: 'First NC State Historic Site honoring an African American; Palmer Institute.' },
  { name: 'North Carolina Central University Art Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Durham', state: 'NC', website: 'https://www.nccu.edu/art-museum', notes: 'HBCU art museum with African American fine arts collection.' },
  { name: 'Museum of the Cape Fear (Wilmington African American Heritage)', institution_type: 'Museum', relationship_status: 'Target', city: 'Fayetteville', state: 'NC', website: 'https://museumofthecapefear.ncdcr.gov', notes: 'Covers 1898 Wilmington Massacre and African American history in Cape Fear region.' },

  // ── Ohio ─────────────────────────────────────────────────────────────
  { name: 'National Afro-American Museum and Cultural Center', institution_type: 'Museum', relationship_status: 'Target', city: 'Wilberforce', state: 'OH', website: 'https://www.naamcc.net', notes: 'Ohio\'s official African American history museum; major collections.' },
  { name: 'Karamu House', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Cleveland', state: 'OH', website: 'https://www.karamuhouse.org', notes: 'Oldest African American theater in the US (1915); arts and cultural programming.' },
  { name: 'National Underground Railroad Freedom Center', institution_type: 'Museum', relationship_status: 'Target', city: 'Cincinnati', state: 'OH', website: 'https://www.freedomcenter.org', notes: 'Major museum dedicated to freedom and the Underground Railroad.' },
  { name: 'African American Museum of Arts (Columbus)', institution_type: 'Museum', relationship_status: 'Target', city: 'Columbus', state: 'OH', website: '', notes: 'Documents African American art and culture in central Ohio.' },
  { name: 'Oberlin Heritage Center — African American Collections', institution_type: 'Archive', relationship_status: 'Target', city: 'Oberlin', state: 'OH', website: 'https://www.oberlinheritagecenter.org', notes: 'Oberlin College abolitionist history; Underground Railroad collections.' },

  // ── Oklahoma ─────────────────────────────────────────────────────────
  { name: 'Greenwood Cultural Center', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Tulsa', state: 'OK', website: 'https://www.greenwoodculturalcenter.com', notes: 'Documents the 1921 Tulsa Race Massacre and Black Wall Street history.' },
  { name: 'John Hope Franklin Center for Reconciliation', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Tulsa', state: 'OK', website: 'https://www.jhfcenter.org', notes: 'Dedicated to racial reconciliation and the memory of the 1921 Tulsa Race Massacre.' },
  { name: 'Oklahoma Jazz Hall of Fame', institution_type: 'Museum', relationship_status: 'Target', city: 'Tulsa', state: 'OK', website: 'https://www.okjazz.org', notes: 'Preserves the legacy of Oklahoma\'s Jazz pioneers — foundational African American art form.' },
  { name: 'Smithville Heritage Museum (All-Black Town)', institution_type: 'Museum', relationship_status: 'Target', city: 'Smithville', state: 'OK', website: '', notes: 'One of many all-Black towns in Oklahoma; preservation and documentation needs.' },

  // ── Pennsylvania ─────────────────────────────────────────────────────
  { name: 'African American Museum in Philadelphia', institution_type: 'Museum', relationship_status: 'Target', city: 'Philadelphia', state: 'PA', website: 'https://www.aampmuseum.org', notes: 'First museum built by a major US city to house and interpret African American culture.' },
  { name: 'Charles L. Blockson Afro-American Collection (Temple University)', institution_type: 'Archive', relationship_status: 'Target', city: 'Philadelphia', state: 'PA', website: 'https://library.temple.edu/blockson', notes: 'One of the most extensive collections of African American literature in the world.' },
  { name: 'Johnson House Historic Site', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Philadelphia', state: 'PA', website: 'https://www.johnsonhouse.org', notes: 'Underground Railroad station; Germantown historic site with active preservation program.' },
  { name: 'Mother Bethel African Methodist Episcopal Church Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Philadelphia', state: 'PA', website: 'https://www.motherbethel.org', notes: 'Oldest AME church in the world (1787 founding); National Historic Landmark.' },
  { name: 'Pittsburgh Center for Arts and Media — African American Heritage', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Pittsburgh', state: 'PA', website: '', notes: 'African American cultural programming in Pittsburgh\'s Hill District.' },
  { name: 'August Wilson African American Cultural Center', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Pittsburgh', state: 'PA', website: 'https://www.augustwilsoncenter.org', notes: 'Named for Pittsburgh playwright August Wilson; major African American cultural hub.' },

  // ── South Carolina ───────────────────────────────────────────────────
  { name: 'Avery Research Center for African American History and Culture (College of Charleston)', institution_type: 'Archive', relationship_status: 'Target', city: 'Charleston', state: 'SC', website: 'https://avery.cofc.edu', notes: 'Major repository for Lowcountry African American history; collections and digitization.' },
  { name: 'I.P. Stanback Museum and Planetarium (South Carolina State University)', institution_type: 'Museum', relationship_status: 'Target', city: 'Orangeburg', state: 'SC', website: 'https://www.scsu.edu/stanbackmuseum', notes: 'HBCU museum with African American art collection.' },
  { name: 'Mann-Simons Site', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Columbia', state: 'SC', website: 'https://www.historiccColumbia.org', notes: 'African American family heritage site in Columbia; preservation priority.' },
  { name: 'Old Slave Mart Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Charleston', state: 'SC', website: 'https://www.oldslavemart.org', notes: 'Site of one of the last known slave auction galleries in the US; collections and interpretation.' },

  // ── Tennessee ────────────────────────────────────────────────────────
  { name: 'National Civil Rights Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Memphis', state: 'TN', website: 'https://www.civilrightsmuseum.org', notes: 'Located at the Lorraine Motel where MLK was assassinated; major preservation site.' },
  { name: 'Beck Cultural Exchange Center', institution_type: 'Cultural Center', relationship_status: 'Target', city: 'Knoxville', state: 'TN', website: 'https://www.beckcenter.net', notes: 'Repository for African American history in East Tennessee.' },
  { name: 'Tennessee State Museum — African American Collections', institution_type: 'Museum', relationship_status: 'Target', city: 'Nashville', state: 'TN', website: 'https://www.tnmuseum.org', notes: 'Major state museum with significant African American Tennessee history.' },
  { name: 'Fisk University Carl Van Vechten Gallery', institution_type: 'Museum', relationship_status: 'Target', city: 'Nashville', state: 'TN', website: 'https://www.fisk.edu/gallery', notes: 'HBCU with landmark Stieglitz collection; significant preservation needs.' },
  { name: 'Memphis Music Hall of Fame', institution_type: 'Museum', relationship_status: 'Target', city: 'Memphis', state: 'TN', website: 'https://www.memphismusichalloffame.com', notes: 'Celebrates Memphis music heritage including African American Blues, Soul, and R&B.' },
  { name: 'W.C. Handy Home and Museum', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Memphis', state: 'TN', website: 'https://www.memphismuseums.org', notes: 'Home of W.C. Handy, "Father of the Blues"; preservation and collections.' },

  // ── Texas ────────────────────────────────────────────────────────────
  { name: 'George Washington Carver Museum, Cultural and Genealogy Center', institution_type: 'Museum', relationship_status: 'Target', city: 'Austin', state: 'TX', website: 'https://www.austintexas.gov/department/george-washington-carver-museum', notes: 'City of Austin museum dedicated to African American history and genealogy.' },
  { name: 'Buffalo Soldiers National Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Houston', state: 'TX', website: 'https://www.buffalosoldiermuseum.com', notes: 'Only museum in the US dedicated exclusively to Buffalo Soldiers.' },
  { name: 'Museum of African American Culture (San Antonio)', institution_type: 'Museum', relationship_status: 'Target', city: 'San Antonio', state: 'TX', website: '', notes: 'Documents African American history and culture in the San Antonio region.' },
  { name: 'African American Library at the Gregory School', institution_type: 'Archive', relationship_status: 'Target', city: 'Houston', state: 'TX', website: 'https://www.houstonlibrary.org/location/african-american-library-gregory-school', notes: 'Largest repository of African American history in Houston; housed in 1870 freedmen\'s school.' },
  { name: 'Freedmen\'s Town Preservation Coalition', institution_type: 'Cultural Organization', relationship_status: 'Target', city: 'Houston', state: 'TX', website: 'https://www.freedmenstown.com', notes: 'Preserves historic 4th Ward Freedmen\'s Town; preservation advocacy and documentation.' },
  { name: 'Juneteenth Museum (Fort Worth)', institution_type: 'Museum', relationship_status: 'Target', city: 'Fort Worth', state: 'TX', website: '', notes: 'Documents the history of Juneteenth and Texas African American freedom.' },
  { name: 'Prairie View A&M University John B. Coleman Library', institution_type: 'Archive', relationship_status: 'Target', city: 'Prairie View', state: 'TX', website: 'https://www.pvamu.edu', notes: 'HBCU archives with Texas African American history collections.' },

  // ── Virginia ─────────────────────────────────────────────────────────
  { name: 'Black History Museum and Cultural Center of Virginia', institution_type: 'Museum', relationship_status: 'Target', city: 'Richmond', state: 'VA', website: 'https://www.blackhistorymuseum.org', notes: 'Documents African American history in Virginia; collections and preservation.' },
  { name: 'Hampton University Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Hampton', state: 'VA', website: 'https://museum.hamptonu.edu', notes: 'HBCU; oldest continuously operating African American museum in the US (1868).' },
  { name: 'Maggie L. Walker National Historic Site', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Richmond', state: 'VA', website: 'https://www.nps.gov/mawa', notes: 'NPS site; home of first female bank president in the US.' },
  { name: 'Virginia Union University L. Douglas Wilder Library', institution_type: 'Archive', relationship_status: 'Target', city: 'Richmond', state: 'VA', website: 'https://www.vuu.edu', notes: 'HBCU archive with Virginia African American history collections.' },
  { name: 'Booker T. Washington National Monument', institution_type: 'Historic Site', relationship_status: 'Target', city: 'Hardy', state: 'VA', website: 'https://www.nps.gov/bowa', notes: 'NPS site; birthplace and early childhood home of Booker T. Washington.' },
  { name: 'Monroe Park African American Heritage Trail (VCU)', institution_type: 'Cultural Organization', relationship_status: 'Target', city: 'Richmond', state: 'VA', website: '', notes: 'Heritage trail documentation and preservation in Richmond\'s historic neighborhoods.' },

  // ── Wisconsin ────────────────────────────────────────────────────────
  { name: 'America\'s Black Holocaust Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Milwaukee', state: 'WI', website: 'https://www.abhmuseum.org', notes: 'Founded by civil rights activist James Cameron; documents lynching and racial terror.' },
  { name: 'Wisconsin Black Historical Society and Museum', institution_type: 'Museum', relationship_status: 'Target', city: 'Milwaukee', state: 'WI', website: 'https://www.wbhsm.org', notes: 'Documents African American history in Wisconsin; collections and community programming.' },

  // ── National / Washington DC (not in starter list) ───────────────────
  { name: 'Association for African American Museums (AAAM)', institution_type: 'Professional Association', relationship_status: 'Partner', city: 'Washington', state: 'DC', website: 'https://www.blackmuseums.org', notes: 'National professional organization for African American museums; key partner and network.' },
  { name: 'National Trust for Historic Preservation — African American Heritage', institution_type: 'Cultural Organization', relationship_status: 'Partner', city: 'Washington', state: 'DC', website: 'https://savingplaces.org/african-american-cultural-heritage', notes: 'NTHP division focused on African American historic sites; advocacy and funding partner.' },
  { name: 'Smithsonian Center for Folklife and Cultural Heritage', institution_type: 'Cultural Organization', relationship_status: 'Target', city: 'Washington', state: 'DC', website: 'https://folklife.si.edu', notes: 'Smithsonian; documentation and presentation of African American folk traditions.' },
  { name: 'National Museum of African Art (Smithsonian)', institution_type: 'Museum', relationship_status: 'Target', city: 'Washington', state: 'DC', website: 'https://africa.si.edu', notes: 'Smithsonian; only US federal museum dedicated to African art; collections and preservation.' },
];

module.exports = { africanAmericanMuseums };
