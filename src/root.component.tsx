import { S3FileList } from "./aws/s3FileList";


export default function Root(props) {
  return (
    <div className="App">
      <header className="App-header">
        <h1>My S3 File App</h1>
        <S3FileList />
      </header>
    </div>
  );
}
