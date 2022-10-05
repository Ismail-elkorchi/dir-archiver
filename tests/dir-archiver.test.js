const DirArchiver = require( '../index' );
const fs = require( 'fs' );
describe( 'dir-archiver test', function () {
	const directoryPath = '.';
	const zipPath = './dir-archiver.zip';
	const includeBaseDirectory = true;
	const excludes = [
		'.eslintrc.js',
		'.git',
		'.github',
		'.gitignore',
		'CHANGELOG.md',
		'package-lock.json',
		'package.json',
		'README.md',
		'test',
		'node_modules'
	];
	const archive = new DirArchiver( directoryPath, zipPath, includeBaseDirectory, excludes );

	it( 'returns the name of the current directory', () => {
		expect( archive.baseDirectory ).toBe( 'dir-archiver' );
	} );

	it( 'normalizes the paths in the excludes array', () => {
		if ( process.platform === 'darwin' ) {
			expect( archive.excludes ).toEqual( [ '.eslintrc.js', '.git', '.github', '.gitignore', 'CHANGELOG.md', 'package-lock.json', 'package.json', 'README.md', 'test', 'node_modules' ] );
		}
	} );
	it( 'create the zip file', () => {
		archive.createZip();
		expect( fs.existsSync( 'dir-archiver.zip' ) ).toBeTruthy();
	} );
} );
