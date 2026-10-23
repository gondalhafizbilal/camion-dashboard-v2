export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <div className="footer">
      <div className="copyright">
        <p>CAMION © {year} All Rights Reserved</p>
      </div>
    </div>
  );
}
