const DirArchiver = require( '../index' );
describe( 'dir-archiver Test', function () {
	const directoryPath = '..';
	const zipPath = './test.zip';
	const includeBaseDirectory = true;
	const excludes = [ './dir-archiver//node_modules' ];
	it( 'parameter must be normalized', () => {
		const archive = new DirArchiver( directoryPath, zipPath, includeBaseDirectory, excludes );
		expect( archive.directoryPath ).toBe( '/Users/ismailelkorchi/Desktop/program' );
		expect( archive.zipPath ).toBe( '/Users/ismailelkorchi/Desktop/program/dir-archiver/test.zip' );
		expect( archive.includeBaseDirectory ).toBe( true );
		expect( archive.baseDirectory ).toBe( 'program' );
		expect( archive.excludes ).toEqual( expect.arrayContaining( [ 'dir-archiver/node_modules' ] ) );
	} );
} );
